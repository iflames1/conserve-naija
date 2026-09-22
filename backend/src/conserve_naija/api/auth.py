"""Email and password authentication for Conserve Naija accounts."""

from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from conserve_naija.api.dependencies import CurrentUser, current_user
from conserve_naija.config import get_settings
from conserve_naija.db.session import get_db
from conserve_naija.models import Organisation, OrganisationMember, User, UserRole
from conserve_naija.services.identity import sync_platform_admin, user_roles

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
_password_hasher = PasswordHasher()

TOKEN_TTL = timedelta(hours=12)


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class SignupRequest(Credentials):
    display_name: str = Field(min_length=1, max_length=160)


class SessionToken(BaseModel):
    token: str
    user_id: str


class OrganisationSummary(BaseModel):
    id: str
    name: str
    slug: str
    role: str


class Profile(BaseModel):
    user_id: str
    email: str
    display_name: str
    roles: list[str]
    organisations: list[OrganisationSummary]
    is_admin: bool


def _issue_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": datetime.now(UTC) + TOKEN_TTL},
        get_settings().jwt_secret,
        algorithm="HS256",
    )


@router.post("/sign-up", response_model=SessionToken, status_code=status.HTTP_201_CREATED)
async def sign_up(request: SignupRequest, db: AsyncSession = Depends(get_db)) -> SessionToken:
    email = request.email.strip().lower()
    if await db.scalar(select(User).where(User.email == email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email is already registered"
        )

    user = User(
        email=email,
        display_name=request.display_name.strip(),
        password_hash=_password_hasher.hash(request.password),
    )
    db.add(user)
    await db.flush()
    db.add(UserRole(user_id=user.id, role="citizen"))
    await db.commit()

    await sync_platform_admin(db, user)
    return SessionToken(token=_issue_token(str(user.id)), user_id=str(user.id))


@router.post("/login", response_model=SessionToken)
async def login(request: Credentials, db: AsyncSession = Depends(get_db)) -> SessionToken:
    email = request.email.strip().lower()
    user = await db.scalar(select(User).where(User.email == email))
    if user is None or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )
    try:
        _password_hasher.verify(user.password_hash, request.password)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        ) from error

    # Re-sync on every sign-in so configuration changes apply to existing accounts.
    await sync_platform_admin(db, user)
    return SessionToken(token=_issue_token(str(user.id)), user_id=str(user.id))


@router.get("/me", response_model=Profile)
async def me(
    user: CurrentUser = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> Profile:
    account = await db.get(User, user.id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    roles = sorted(await user_roles(db, user.id))
    rows = (
        await db.execute(
            select(Organisation, OrganisationMember.role)
            .join(OrganisationMember, OrganisationMember.organisation_id == Organisation.id)
            .where(OrganisationMember.user_id == user.id)
            .order_by(Organisation.name)
        )
    ).all()
    return Profile(
        user_id=str(account.id),
        email=account.email,
        display_name=account.display_name,
        roles=roles,
        organisations=[
            OrganisationSummary(id=str(item.id), name=item.name, slug=item.slug, role=role)
            for item, role in rows
        ],
        is_admin="admin" in roles,
    )
