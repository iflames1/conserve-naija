"""Core citizen and machine HTTP routes."""

import uuid

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from conserve_naija.api.dependencies import (
    AuthenticatedMachine,
    CurrentUser,
    authenticated_machine,
    current_user,
)
from conserve_naija.api.schemas import (
    ClaimSessionRequest,
    DepositResult,
    MeasurementRequest,
    ProgressRequest,
    SessionResponse,
    StartSessionRequest,
)
from conserve_naija.db.session import get_db
from conserve_naija.services import recycling

router = APIRouter(prefix="/api/v1")


@router.post(
    "/recycling-sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED
)
async def create_session(
    _: StartSessionRequest,
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session, otp = await recycling.start_session(db, user.id)
    return SessionResponse(
        id=session.id, status=session.status, otp=otp, otp_expires_at=session.otp_expires_at
    )


@router.post("/device/sessions/claim", response_model=SessionResponse)
async def claim_session(
    request: ClaimSessionRequest,
    machine: AuthenticatedMachine = Depends(authenticated_machine),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = await recycling.claim_session(db, machine.record, request.code)
    return SessionResponse(id=session.id, status=session.status)


@router.post("/device/sessions/{session_id}/progress", response_model=SessionResponse)
async def progress_session(
    session_id: str,
    request: ProgressRequest,
    machine: AuthenticatedMachine = Depends(authenticated_machine),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = await recycling.mark_sorting(db, machine.record, uuid.UUID(session_id))
    return SessionResponse(id=session.id, status=session.status)


@router.post("/device/sessions/{session_id}/measurement", response_model=DepositResult)
async def submit_measurement(
    session_id: str,
    request: MeasurementRequest,
    idempotency_key: str = Header(min_length=1, max_length=160),
    machine: AuthenticatedMachine = Depends(authenticated_machine),
    db: AsyncSession = Depends(get_db),
) -> DepositResult:
    deposit = await recycling.confirm_measurement(
        db, machine.record, uuid.UUID(session_id), request, idempotency_key
    )
    return DepositResult(
        deposit_id=deposit.id,
        conserve_points=sum(fraction.conserve_points for fraction in deposit.fractions),
        fractions=[
            {
                "material_id": fraction.material_id,
                "weight_grams": fraction.weight_grams,
                "conserve_points": fraction.conserve_points,
            }
            for fraction in deposit.fractions
        ],
        status=deposit.status,
    )


@router.get("/healthz", include_in_schema=False)
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
