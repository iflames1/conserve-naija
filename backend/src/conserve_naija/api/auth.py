"""Minimal email/password authentication for citizen session creation."""

from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from conserve_naija.config import get_settings
from conserve_naija.db.session import get_db
from conserve_naija.models import User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
_password_hasher = PasswordHasher()


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class LoginResponse(BaseModel):
    token: str
    user_id: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)) -> LoginResponse:
    user = await db.scalar(select(User).where(User.email == request.email))
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
    token = jwt.encode(
        {"sub": str(user.id), "exp": datetime.now(UTC) + timedelta(hours=12)},
        get_settings().jwt_secret,
        algorithm="HS256",
    )
    return LoginResponse(token=token, user_id=str(user.id))
