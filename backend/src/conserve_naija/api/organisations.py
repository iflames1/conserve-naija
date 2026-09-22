"""Organisation membership management."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from conserve_naija.api.dependencies import CurrentUser, current_user
from conserve_naija.db.session import get_db
from conserve_naija.models import Organisation, OrganisationMember, User, UserRole
from conserve_naija.services.identity import (
    ORGANISATION_ADMIN_ROLE,
    ORGANISATION_MEMBER_ROLE,
    PLATFORM_ADMIN_ROLE,
    user_roles,
)

router = APIRouter(prefix="/api/v1/organisations", tags=["organisations"])


class OrganisationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    role: str | None


class MemberResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    display_name: str
    role: str


class AddMemberRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=320)
    role: str = Field(default=ORGANISATION_MEMBER_ROLE, pattern="^(member|admin)$")


async def _require_org_manager(
    db: AsyncSession, user_id: uuid.UUID, organisation_id: uuid.UUID
) -> None:
    """Allow platform administrators and administrators of this organisation."""
    if PLATFORM_ADMIN_ROLE in await user_roles(db, user_id):
        return
    membership = await db.scalar(
        select(OrganisationMember).where(
            OrganisationMember.organisation_id == organisation_id,
            OrganisationMember.user_id == user_id,
            OrganisationMember.role == ORGANISATION_ADMIN_ROLE,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organisation administrator access required",
        )


@router.get("", response_model=list[OrganisationResponse])
async def list_organisations(
    user: CurrentUser = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[OrganisationResponse]:
    if PLATFORM_ADMIN_ROLE in await user_roles(db, user.id):
        organisations = (await db.scalars(select(Organisation).order_by(Organisation.name))).all()
        return [
            OrganisationResponse(
                id=item.id, name=item.name, slug=item.slug, role=PLATFORM_ADMIN_ROLE
            )
            for item in organisations
        ]

    rows = (
        await db.execute(
            select(Organisation, OrganisationMember.role)
            .join(OrganisationMember, OrganisationMember.organisation_id == Organisation.id)
            .where(OrganisationMember.user_id == user.id)
            .order_by(Organisation.name)
        )
    ).all()
    return [
        OrganisationResponse(id=item.id, name=item.name, slug=item.slug, role=role)
        for item, role in rows
    ]


@router.get("/{organisation_id}/members", response_model=list[MemberResponse])
async def list_members(
    organisation_id: uuid.UUID,
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MemberResponse]:
    await _require_org_manager(db, user.id, organisation_id)
    rows = (
        await db.execute(
            select(User, OrganisationMember.role)
            .join(OrganisationMember, OrganisationMember.user_id == User.id)
            .where(OrganisationMember.organisation_id == organisation_id)
            .order_by(User.email)
        )
    ).all()
    return [
        MemberResponse(
            user_id=member.id,
            email=member.email,
            display_name=member.display_name,
            role=role,
        )
        for member, role in rows
    ]


@router.post(
    "/{organisation_id}/members",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    organisation_id: uuid.UUID,
    request: AddMemberRequest,
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MemberResponse:
    await _require_org_manager(db, user.id, organisation_id)
    organisation = await db.get(Organisation, organisation_id)
    if organisation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organisation not found")

    email = request.email.strip().lower()
    member = await db.scalar(select(User).where(User.email == email))
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Conserve Naija account uses that email yet",
        )

    existing = await db.scalar(
        select(OrganisationMember).where(
            OrganisationMember.organisation_id == organisation_id,
            OrganisationMember.user_id == member.id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That person is already part of this organisation",
        )

    db.add(
        OrganisationMember(organisation_id=organisation_id, user_id=member.id, role=request.role)
    )
    roles = await user_roles(db, member.id)
    if ORGANISATION_MEMBER_ROLE not in roles:
        db.add(UserRole(user_id=member.id, role=ORGANISATION_MEMBER_ROLE))
    await db.commit()

    return MemberResponse(
        user_id=member.id,
        email=member.email,
        display_name=member.display_name,
        role=request.role,
    )


@router.delete("/{organisation_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    organisation_id: uuid.UUID,
    member_id: uuid.UUID,
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _require_org_manager(db, user.id, organisation_id)
    if member_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot remove yourself from the organisation",
        )
    membership = await db.scalar(
        select(OrganisationMember).where(
            OrganisationMember.organisation_id == organisation_id,
            OrganisationMember.user_id == member_id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="That person is not in this organisation"
        )
    await db.delete(membership)
    await db.commit()
