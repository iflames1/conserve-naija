"""Citizen-facing recycling history and Conserve Points summary."""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from conserve_naija.api.dependencies import CurrentUser, current_user
from conserve_naija.db.session import get_db
from conserve_naija.models import (
    ConserveSite,
    CpLedgerEntry,
    Deposit,
    DepositFraction,
    Material,
)

router = APIRouter(prefix="/api/v1/me", tags=["citizen"])


class DepositLine(BaseModel):
    material: str
    weight_grams: int
    conserve_points: int


class DepositSummary(BaseModel):
    id: uuid.UUID
    site_name: str
    conserve_points: int
    created_at: str
    lines: list[DepositLine]


class ActivitySummary(BaseModel):
    conserve_points: int
    total_weight_grams: int
    deposits: int
    recent: list[DepositSummary]


@router.get("/activity", response_model=ActivitySummary)
async def activity(
    user: CurrentUser = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> ActivitySummary:
    """Return the citizen's balance, totals, and most recent deposits."""
    balance = await db.scalar(
        select(func.coalesce(func.sum(CpLedgerEntry.amount), 0)).where(
            CpLedgerEntry.user_id == user.id
        )
    )
    deposit_count = await db.scalar(
        select(func.count(Deposit.id)).where(Deposit.user_id == user.id)
    )
    total_weight = await db.scalar(
        select(func.coalesce(func.sum(DepositFraction.weight_grams), 0))
        .join(Deposit, Deposit.id == DepositFraction.deposit_id)
        .where(Deposit.user_id == user.id)
    )

    rows = (
        await db.execute(
            select(Deposit.id, ConserveSite.name, Deposit.created_at)
            .join(ConserveSite, ConserveSite.id == Deposit.site_id)
            .where(Deposit.user_id == user.id)
            .order_by(Deposit.created_at.desc())
            .limit(20)
        )
    ).all()

    recent: list[DepositSummary] = []
    for deposit_id, site_name, created_at in rows:
        lines = (
            await db.execute(
                select(Material.name, DepositFraction.weight_grams, DepositFraction.conserve_points)
                .join(Material, Material.id == DepositFraction.material_id)
                .where(DepositFraction.deposit_id == deposit_id)
                .order_by(Material.name)
            )
        ).all()
        recent.append(
            DepositSummary(
                id=deposit_id,
                site_name=site_name,
                conserve_points=sum(points for _, _, points in lines),
                created_at=created_at.isoformat(),
                lines=[
                    DepositLine(material=material, weight_grams=grams, conserve_points=points)
                    for material, grams, points in lines
                ],
            )
        )

    return ActivitySummary(
        conserve_points=balance or 0,
        total_weight_grams=total_weight or 0,
        deposits=deposit_count or 0,
        recent=recent,
    )
