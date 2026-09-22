"""Machine (IoT device) endpoints.

These are registered without a path prefix on purpose. The ESP32 firmware speaks
`/iot/devices/me/...` at the server root, matching the platform's original device
protocol, so those paths must resolve exactly as the device sends them. The
canonical `/api/v1/device/...` shape is registered alongside for new clients and
appears in the generated API docs.

Each handler is defined once and attached to both paths, so the two shapes can
never drift apart.
"""

import uuid

from fastapi import APIRouter, Depends, Header
from sqlalchemy import func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from conserve_naija.api.dependencies import AuthenticatedMachine, authenticated_machine
from conserve_naija.api.schemas import (
    ClaimSessionRequest,
    DeviceResponse,
    HeartbeatRequest,
    MachineDepositResult,
    MachineFraction,
    MeasurementRequest,
    ProgressRequest,
    SessionResponse,
    TelemetryRequest,
)
from conserve_naija.api.websocket import broker
from conserve_naija.db.session import get_db
from conserve_naija.models import MachineTelemetry
from conserve_naija.services import recycling

router = APIRouter(tags=["machine"])

# Legacy firmware path -> canonical path. Both resolve to the same handler.
LEGACY = "/iot/devices/me"
CANONICAL = "/api/v1/device"


@router.get(f"{LEGACY}", response_model=DeviceResponse, include_in_schema=False)
@router.get(f"{CANONICAL}/me", response_model=DeviceResponse)
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


@router.post(f"{LEGACY}/heartbeat", include_in_schema=False)
@router.post(f"{CANONICAL}/heartbeat")
async def device_heartbeat(
    request: HeartbeatRequest,
    machine: AuthenticatedMachine = Depends(authenticated_machine),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    machine.record.last_seen_at = sa_func.now()
    machine.record.firmware_version = request.firmware_version or machine.record.firmware_version
    await db.commit()
    return {"ok": True}


@router.post(f"{LEGACY}/telemetry", include_in_schema=False)
@router.post(f"{CANONICAL}/telemetry")
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
            latitude=request.resolved_latitude,
            longitude=request.resolved_longitude,
            payload=request.model_dump(),
        )
    )
    await db.commit()
    return {"ok": True, "telemetryId": str(machine.record.id)}


@router.post(f"{LEGACY}/sessions/claim", response_model=SessionResponse, include_in_schema=False)
@router.post(f"{CANONICAL}/sessions/claim", response_model=SessionResponse)
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


@router.post(
    f"{LEGACY}/sessions/{{session_id}}/progress",
    response_model=SessionResponse,
    include_in_schema=False,
)
@router.post(f"{CANONICAL}/sessions/{{session_id}}/progress", response_model=SessionResponse)
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


@router.post(
    f"{LEGACY}/sessions/{{session_id}}/measurement",
    response_model=MachineDepositResult,
    include_in_schema=False,
)
@router.post(
    f"{CANONICAL}/sessions/{{session_id}}/measurement", response_model=MachineDepositResult
)
async def submit_measurement(
    session_id: str,
    request: MeasurementRequest,
    idempotency_key: str | None = Header(default=None, max_length=160),
    machine: AuthenticatedMachine = Depends(authenticated_machine),
    db: AsyncSession = Depends(get_db),
) -> MachineDepositResult:
    # The optional header keeps machine retries safe, but the shipped firmware
    # does not send one. A session produces exactly one deposit, so the session
    # id is a sound fallback: a retried measurement matches its original deposit
    # instead of being rejected or awarding Conserve Points twice.
    key = idempotency_key or f"session:{session_id}"
    outcome = await recycling.confirm_measurement(
        db, machine.record, uuid.UUID(session_id), request, key
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
