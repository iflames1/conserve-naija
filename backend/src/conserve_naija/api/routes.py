"""Core citizen and machine HTTP routes."""

import uuid

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from conserve_naija.api.dependencies import (
    AuthenticatedMachine,
    CurrentUser,
    authenticated_machine,
    current_user,
)
from conserve_naija.api.schemas import (
    ClaimSessionRequest,
    DeviceResponse,
    HeartbeatRequest,
    MachineDepositResult,
    MachineFraction,
    MeasurementRequest,
    ProgressRequest,
    SessionResponse,
    SiteResponse,
    StartSessionRequest,
    TelemetryRequest,
)
from conserve_naija.api.websocket import broker
from conserve_naija.db.session import get_db
from conserve_naija.models import (
    ConserveSite,
    MachineTelemetry,
    Material,
    RecyclingSession,
    SiteMaterial,
)
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


@router.get("/recycling-sessions/active", response_model=SessionResponse | None)
async def active_session(
    user: CurrentUser = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> SessionResponse | None:
    session = await db.scalar(
        select(RecyclingSession)
        .where(
            RecyclingSession.user_id == user.id,
            RecyclingSession.status.not_in(("completed", "expired", "cancelled", "failed")),
        )
        .order_by(RecyclingSession.created_at.desc())
    )
    if session is None:
        return None
    return SessionResponse(
        id=session.id,
        status=session.status,
        otp_expires_at=session.otp_expires_at,
    )


@router.get("/recycling-sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: uuid.UUID,
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = await db.scalar(
        select(RecyclingSession).where(
            RecyclingSession.id == session_id, RecyclingSession.user_id == user.id
        )
    )
    if session is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Recycling session not found")
    return SessionResponse(id=session.id, status=session.status)


@router.post("/recycling-sessions/{session_id}/cancel", response_model=SessionResponse)
async def cancel_session(
    session_id: uuid.UUID,
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = await db.scalar(
        select(RecyclingSession).where(
            RecyclingSession.id == session_id, RecyclingSession.user_id == user.id
        )
    )
    if session is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Recycling session not found")
    session.status = "cancelled"
    await db.commit()
    return SessionResponse(id=session.id, status=session.status)


@router.get("/sites", response_model=list[SiteResponse])
async def public_sites(db: AsyncSession = Depends(get_db)) -> list[SiteResponse]:
    sites = (await db.scalars(select(ConserveSite).where(ConserveSite.status == "active"))).all()
    result: list[SiteResponse] = []
    for site in sites:
        materials = await db.scalars(
            select(Material.name)
            .join(SiteMaterial, SiteMaterial.material_id == Material.id)
            .where(SiteMaterial.site_id == site.id, Material.active.is_(True))
        )
        result.append(
            SiteResponse(
                id=site.id,
                name=site.name,
                slug=site.slug,
                address=site.address,
                status=site.status,
                latitude=float(site.latitude) if site.latitude is not None else None,
                longitude=float(site.longitude) if site.longitude is not None else None,
                accepted_materials=list(materials),
            )
        )
    return result


@router.get("/sites/{site_id}", response_model=SiteResponse)
async def public_site(site_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> SiteResponse:
    site = await db.scalar(
        select(ConserveSite).where(ConserveSite.id == site_id, ConserveSite.status == "active")
    )
    if site is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Conserve Site not found")
    materials = await db.scalars(
        select(Material.name)
        .join(SiteMaterial, SiteMaterial.material_id == Material.id)
        .where(SiteMaterial.site_id == site.id, Material.active.is_(True))
    )
    return SiteResponse(
        id=site.id,
        name=site.name,
        slug=site.slug,
        address=site.address,
        status=site.status,
        latitude=float(site.latitude) if site.latitude is not None else None,
        longitude=float(site.longitude) if site.longitude is not None else None,
        accepted_materials=list(materials),
    )


@router.post("/device/sessions/claim", response_model=SessionResponse)
@router.post(
    "/iot/devices/me/sessions/claim", response_model=SessionResponse, include_in_schema=False
)
async def claim_session(
    request: ClaimSessionRequest,
    machine: AuthenticatedMachine = Depends(authenticated_machine),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = await recycling.claim_session(db, machine.record, request.code)
    await broker.publish(
        session.user_id,
        "session.updated",
        {"id": str(session.id), "status": session.status},
    )
    return SessionResponse(id=session.id, status=session.status)


@router.get("/device/me", response_model=DeviceResponse)
@router.get("/iot/devices/me", response_model=DeviceResponse, include_in_schema=False)
async def device_me(
    machine: AuthenticatedMachine = Depends(authenticated_machine),
) -> DeviceResponse:
    record = machine.record
    return DeviceResponse(
        id=record.id,
        external_id=record.external_id,
        site_id=record.site_id,
        status=record.status,
        last_seen_at=record.last_seen_at,
    )


@router.post("/device/heartbeat")
@router.post("/iot/devices/me/heartbeat", include_in_schema=False)
async def device_heartbeat(
    request: HeartbeatRequest,
    machine: AuthenticatedMachine = Depends(authenticated_machine),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    machine.record.last_seen_at = sa_func.now()
    machine.record.firmware_version = request.firmware_version or machine.record.firmware_version
    await db.commit()
    return {"ok": True}


@router.post("/device/telemetry")
@router.post("/iot/devices/me/telemetry", include_in_schema=False)
async def device_telemetry(
    request: TelemetryRequest,
    machine: AuthenticatedMachine = Depends(authenticated_machine),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool | str]:
    machine.record.last_seen_at = sa_func.now()
    db.add(
        MachineTelemetry(
            machine_id=machine.record.id,
            recorded_at=sa_func.now(),
            latitude=request.latitude,
            longitude=request.longitude,
            payload=request.model_dump(),
        )
    )
    await db.commit()
    return {"ok": True, "telemetryId": str(machine.record.id)}


@router.post("/device/sessions/{session_id}/progress", response_model=SessionResponse)
@router.post(
    "/iot/devices/me/sessions/{session_id}/progress",
    response_model=SessionResponse,
    include_in_schema=False,
)
async def progress_session(
    session_id: str,
    request: ProgressRequest,
    machine: AuthenticatedMachine = Depends(authenticated_machine),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = await recycling.mark_sorting(db, machine.record, uuid.UUID(session_id))
    await broker.publish(
        session.user_id,
        "session.updated",
        {"id": str(session.id), "status": session.status},
    )
    return SessionResponse(id=session.id, status=session.status)


@router.post("/device/sessions/{session_id}/measurement", response_model=MachineDepositResult)
@router.post(
    "/iot/devices/me/sessions/{session_id}/measurement",
    response_model=MachineDepositResult,
    include_in_schema=False,
)
async def submit_measurement(
    session_id: str,
    request: MeasurementRequest,
    idempotency_key: str = Header(min_length=1, max_length=160),
    machine: AuthenticatedMachine = Depends(authenticated_machine),
    db: AsyncSession = Depends(get_db),
) -> MachineDepositResult:
    outcome = await recycling.confirm_measurement(
        db, machine.record, uuid.UUID(session_id), request, idempotency_key
    )
    if outcome.user_id is not None:
        # The citizen's app consumes this event, so it keeps the app's
        # snake_case shape even though the machine reply is camelCase.
        await broker.publish(
            outcome.user_id,
            "session.updated",
            {
                "id": str(outcome.session_id),
                "status": "completed",
                "deposit_id": str(outcome.deposit_id),
                "conserve_points": outcome.conserve_points,
                "fractions": outcome.fractions,
            },
        )
    return MachineDepositResult(
        deposit_id=outcome.deposit_id,
        conserve_points=outcome.conserve_points,
        fractions=[
            MachineFraction(
                material=str(fraction["material"]),
                weight_grams=int(fraction["weight_grams"]),
                conserve_points=int(fraction["conserve_points"]),
            )
            for fraction in outcome.fractions
        ],
        status=outcome.status,
    )


@router.get("/healthz", include_in_schema=False)
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
