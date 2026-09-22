"""Authentication dependencies for human and machine clients."""

import uuid
from dataclasses import dataclass

import jwt
from argon2 import PasswordHasher
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from conserve_naija.config import get_settings
from conserve_naija.db.session import get_db
from conserve_naija.models import Machine

_password_hasher = PasswordHasher()


@dataclass(frozen=True, slots=True)
class CurrentUser:
    id: uuid.UUID


@dataclass(frozen=True, slots=True)
class AuthenticatedMachine:
    record: Machine


async def current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required"
        )
    try:
        claims = jwt.decode(
            authorization.removeprefix("Bearer "),
            get_settings().jwt_secret,
            algorithms=["HS256"],
        )
        return CurrentUser(id=uuid.UUID(str(claims["sub"])))
    except (KeyError, ValueError, jwt.InvalidTokenError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from error


async def authenticated_machine(
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> AuthenticatedMachine:
    if not authorization or not authorization.startswith("Device "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Device credential required"
        )
    credential = authorization.removeprefix("Device ").strip()
    if ":" in credential:
        external_id, secret = credential.split(":", maxsplit=1)
        machines = await db.scalars(select(Machine).where(Machine.external_id == external_id))
    else:
        secret = credential
        machines = await db.scalars(select(Machine))

    machine = next((candidate for candidate in machines if candidate.status == "active"), None)
    if machine is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Machine unavailable")
    try:
        _password_hasher.verify(machine.credential_hash, secret)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device credential"
        ) from error
    return AuthenticatedMachine(record=machine)
