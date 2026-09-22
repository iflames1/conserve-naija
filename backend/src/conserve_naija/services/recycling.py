"""Transactional recycling session and deposit operations."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from conserve_naija.api.schemas import MeasurementRequest
from conserve_naija.domain.otp import OTP_TTL, generate_otp, hash_otp, is_valid_otp
from conserve_naija.domain.rewards import calculate_reward, grams_from_kg
from conserve_naija.domain.sessions import SessionStatus, transition
from conserve_naija.models import (
    CpLedgerEntry,
    Deposit,
    DepositFraction,
    Machine,
    Material,
    MaterialPrice,
    RecyclingSession,
    SiteInventory,
    SiteMaterial,
)


@dataclass(frozen=True, slots=True)
class DepositOutcome:
    """Backend-computed result of a confirmed deposit.

    Carries the values the API returns so callers never read ORM relationships
    after the session closes.
    """

    deposit_id: uuid.UUID
    conserve_points: int
    fractions: list[dict[str, int | str]]
    status: str


async def start_session(db: AsyncSession, user_id: uuid.UUID) -> tuple[RecyclingSession, str]:
    otp = generate_otp()
    session = RecyclingSession(
        user_id=user_id,
        otp_digest=hash_otp(otp),
        otp_expires_at=datetime.now(UTC) + OTP_TTL,
        status=SessionStatus.WAITING_FOR_MACHINE,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session, otp


async def claim_session(db: AsyncSession, machine: Machine, code: str) -> RecyclingSession:
    session = await db.scalar(
        select(RecyclingSession)
        .where(
            RecyclingSession.otp_digest == hash_otp(code),
            RecyclingSession.status == SessionStatus.WAITING_FOR_MACHINE,
        )
        .with_for_update()
    )
    if session is None or not is_valid_otp(
        code, session.otp_digest, session.otp_expires_at, session.otp_used_at
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Invalid or expired Conserve OTP"
        )
    if machine.site_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Machine has no Conserve Site"
        )
    session.machine_id = machine.id
    session.site_id = machine.site_id
    session.otp_used_at = datetime.now(UTC)
    session.status = transition(session.status, SessionStatus.CONNECTED)
    await db.commit()
    await db.refresh(session)
    return session


async def mark_sorting(
    db: AsyncSession, machine: Machine, session_id: uuid.UUID
) -> RecyclingSession:
    session = await _machine_session(db, machine, session_id)
    session.status = transition(session.status, SessionStatus.SORTING)
    await db.commit()
    await db.refresh(session)
    return session


async def confirm_measurement(
    db: AsyncSession,
    machine: Machine,
    session_id: uuid.UUID,
    request: MeasurementRequest,
    idempotency_key: str,
) -> DepositOutcome:
    session = await _machine_session(db, machine, session_id)
    # Idempotency is resolved before the state check so a machine retry after a
    # lost response returns the original confirmed deposit rather than an error.
    duplicate = await db.scalar(
        select(Deposit).where(
            Deposit.idempotency_key == idempotency_key, Deposit.session_id == session.id
        )
    )
    if duplicate is not None:
        # A repeated machine request must return the original result without
        # awarding Conserve Points a second time.
        rows = (
            await db.execute(
                select(DepositFraction, Material.slug)
                .join(Material, Material.id == DepositFraction.material_id)
                .where(DepositFraction.deposit_id == duplicate.id)
            )
        ).all()
        return DepositOutcome(
            deposit_id=duplicate.id,
            conserve_points=sum(fraction.conserve_points for fraction, _ in rows),
            fractions=[
                {
                    "material": slug,
                    "weight_grams": fraction.weight_grams,
                    "conserve_points": fraction.conserve_points,
                }
                for fraction, slug in rows
            ],
            status=duplicate.status,
        )
    if session.status not in {SessionStatus.SORTING, SessionStatus.MEASURING}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Session is not ready for measurement"
        )
    if session.site_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Session has no Conserve Site"
        )

    site_materials = {
        item.material_id
        for item in (
            await db.scalars(select(SiteMaterial).where(SiteMaterial.site_id == session.site_id))
        ).all()
    }
    fractions: list[tuple[Material, int, int, int]] = []
    for line in request.fractions:
        material = await db.scalar(
            select(Material).where(Material.slug == line.material, Material.active.is_(True))
        )
        if material is None or material.id not in site_materials:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Material is not accepted at this site",
            )
        price = await db.scalar(
            select(MaterialPrice)
            .where(
                MaterialPrice.material_id == material.id,
                MaterialPrice.organisation_id == machine.organisation_id,
            )
            .order_by(MaterialPrice.effective_from.desc())
        )
        if price is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No active price for material",
            )
        grams = grams_from_kg(line.weight_kg)
        reward = calculate_reward(grams, price.price_per_kg_naira)
        fractions.append((material, grams, price.price_per_kg_naira, reward.conserve_points))

    session.status = SessionStatus.PROCESSING
    deposit = Deposit(
        session_id=session.id,
        user_id=session.user_id,
        machine_id=machine.id,
        site_id=session.site_id,
        idempotency_key=idempotency_key,
        status="confirmed",
    )
    db.add(deposit)
    await db.flush()
    total = 0
    for material, grams, price, points in fractions:
        db.add(
            DepositFraction(
                deposit_id=deposit.id,
                material_id=material.id,
                weight_grams=grams,
                price_per_kg_naira=price,
                conserve_points=points,
            )
        )
        inventory = await db.scalar(
            select(SiteInventory)
            .where(
                SiteInventory.site_id == session.site_id, SiteInventory.material_id == material.id
            )
            .with_for_update()
        )
        if inventory is None:
            inventory = SiteInventory(
                site_id=session.site_id,
                material_id=material.id,
                weight_grams=0,
                updated_at=datetime.now(UTC),
            )
            db.add(inventory)
        inventory.weight_grams += grams
        inventory.updated_at = datetime.now(UTC)
        total += points
    db.add(
        CpLedgerEntry(
            user_id=session.user_id,
            deposit_id=deposit.id,
            amount=total,
            created_at=datetime.now(UTC),
        )
    )
    session.status = transition(session.status, SessionStatus.COMPLETED)
    await db.commit()
    return DepositOutcome(
        deposit_id=deposit.id,
        conserve_points=total,
        fractions=[
            {
                "material": material.slug,
                "weight_grams": grams,
                "conserve_points": points,
            }
            for material, grams, _, points in fractions
        ],
        status=deposit.status,
    )


async def _machine_session(
    db: AsyncSession, machine: Machine, session_id: uuid.UUID
) -> RecyclingSession:
    session = await db.scalar(
        select(RecyclingSession).where(RecyclingSession.id == session_id).with_for_update()
    )
    if session is None or session.machine_id != machine.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Machine session not found"
        )
    return session
