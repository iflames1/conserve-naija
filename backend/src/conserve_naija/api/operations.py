"""Read-only operational reporting for an organisation."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from conserve_naija.api.dependencies import CurrentUser, current_user
from conserve_naija.api.organisations import _require_org_manager
from conserve_naija.db.session import get_db
from conserve_naija.domain.rewards import GRAMS_PER_KILOGRAM
from conserve_naija.models import (
    ConserveSite,
    CpLedgerEntry,
    Deposit,
    Machine,
    Material,
    Pickup,
    SiteInventory,
    SiteMaterial,
)

router = APIRouter(prefix="/api/v1/organisations", tags=["operations"])


class Overview(BaseModel):
    sites: int
    machines: int
    active_machines: int
    deposits: int
    conserve_points_awarded: int
    inventory_grams: int
    pickups_ready: int


class SiteSummary(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    address: str
    status: str
    machines: int
    active_machines: int
    accepted_materials: list[str]
    inventory_grams: int


class InventoryRow(BaseModel):
    site_id: uuid.UUID
    site_name: str
    material: str
    weight_grams: int
    threshold_grams: int | None
    ready_for_pickup: bool


class PickupRow(BaseModel):
    id: uuid.UUID
    site_name: str
    material: str
    weight_grams: int
    status: str


async def _site_ids(db: AsyncSession, organisation_id: uuid.UUID) -> list[uuid.UUID]:
    return list(
        (
            await db.scalars(
                select(ConserveSite.id).where(ConserveSite.organisation_id == organisation_id)
            )
        ).all()
    )


@router.get("/{organisation_id}/overview", response_model=Overview)
async def organisation_overview(
    organisation_id: uuid.UUID,
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Overview:
    await _require_org_manager(db, user.id, organisation_id)

    sites = await db.scalar(
        select(func.count(ConserveSite.id)).where(ConserveSite.organisation_id == organisation_id)
    )
    machines = await db.scalar(
        select(func.count(Machine.id)).where(Machine.organisation_id == organisation_id)
    )
    active_machines = await db.scalar(
        select(func.count(Machine.id)).where(
            Machine.organisation_id == organisation_id, Machine.status == "active"
        )
    )
    deposits = await db.scalar(
        select(func.count(Deposit.id))
        .join(ConserveSite, ConserveSite.id == Deposit.site_id)
        .where(ConserveSite.organisation_id == organisation_id)
    )
    points = await db.scalar(
        select(func.coalesce(func.sum(CpLedgerEntry.amount), 0))
        .join(Deposit, Deposit.id == CpLedgerEntry.deposit_id)
        .join(ConserveSite, ConserveSite.id == Deposit.site_id)
        .where(ConserveSite.organisation_id == organisation_id)
    )
    inventory = await db.scalar(
        select(func.coalesce(func.sum(SiteInventory.weight_grams), 0))
        .join(ConserveSite, ConserveSite.id == SiteInventory.site_id)
        .where(ConserveSite.organisation_id == organisation_id)
    )
    pickups_ready = await db.scalar(
        select(func.count(Pickup.id))
        .join(ConserveSite, ConserveSite.id == Pickup.site_id)
        .where(ConserveSite.organisation_id == organisation_id, Pickup.status == "ready")
    )

    return Overview(
        sites=sites or 0,
        machines=machines or 0,
        active_machines=active_machines or 0,
        deposits=deposits or 0,
        conserve_points_awarded=points or 0,
        inventory_grams=inventory or 0,
        pickups_ready=pickups_ready or 0,
    )


@router.get("/{organisation_id}/sites", response_model=list[SiteSummary])
async def organisation_sites(
    organisation_id: uuid.UUID,
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SiteSummary]:
    await _require_org_manager(db, user.id, organisation_id)

    sites = (
        await db.scalars(
            select(ConserveSite)
            .where(ConserveSite.organisation_id == organisation_id)
            .order_by(ConserveSite.name)
        )
    ).all()

    summaries: list[SiteSummary] = []
    for site in sites:
        machine_total = await db.scalar(
            select(func.count(Machine.id)).where(Machine.site_id == site.id)
        )
        machine_active = await db.scalar(
            select(func.count(Machine.id)).where(
                Machine.site_id == site.id, Machine.status == "active"
            )
        )
        materials = (
            await db.scalars(
                select(Material.name)
                .join(SiteMaterial, SiteMaterial.material_id == Material.id)
                .where(SiteMaterial.site_id == site.id, Material.active.is_(True))
                .order_by(Material.name)
            )
        ).all()
        inventory = await db.scalar(
            select(func.coalesce(func.sum(SiteInventory.weight_grams), 0)).where(
                SiteInventory.site_id == site.id
            )
        )
        summaries.append(
            SiteSummary(
                id=site.id,
                name=site.name,
                slug=site.slug,
                address=site.address,
                status=site.status,
                machines=machine_total or 0,
                active_machines=machine_active or 0,
                accepted_materials=list(materials),
                inventory_grams=inventory or 0,
            )
        )
    return summaries


@router.get("/{organisation_id}/inventory", response_model=list[InventoryRow])
async def organisation_inventory(
    organisation_id: uuid.UUID,
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[InventoryRow]:
    await _require_org_manager(db, user.id, organisation_id)

    rows = (
        await db.execute(
            select(
                ConserveSite.id,
                ConserveSite.name,
                Material.name,
                SiteInventory.weight_grams,
                SiteMaterial.pickup_threshold_grams,
                ConserveSite.default_pickup_threshold_grams,
            )
            .join(ConserveSite, ConserveSite.id == SiteInventory.site_id)
            .join(Material, Material.id == SiteInventory.material_id)
            .outerjoin(
                SiteMaterial,
                (SiteMaterial.site_id == SiteInventory.site_id)
                & (SiteMaterial.material_id == SiteInventory.material_id),
            )
            .where(ConserveSite.organisation_id == organisation_id)
            .order_by(ConserveSite.name, Material.name)
        )
    ).all()

    inventory: list[InventoryRow] = []
    for site_id, site_name, material, grams, threshold, default_threshold in rows:
        effective_threshold = threshold if threshold is not None else default_threshold
        inventory.append(
            InventoryRow(
                site_id=site_id,
                site_name=site_name,
                material=material,
                weight_grams=grams,
                threshold_grams=effective_threshold,
                ready_for_pickup=grams >= effective_threshold,
            )
        )
    return inventory


@router.get("/{organisation_id}/pickups", response_model=list[PickupRow])
async def organisation_pickups(
    organisation_id: uuid.UUID,
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PickupRow]:
    await _require_org_manager(db, user.id, organisation_id)

    rows = (
        await db.execute(
            select(Pickup.id, ConserveSite.name, Material.name, Pickup.weight_grams, Pickup.status)
            .join(ConserveSite, ConserveSite.id == Pickup.site_id)
            .join(Material, Material.id == Pickup.material_id)
            .where(ConserveSite.organisation_id == organisation_id)
            .order_by(Pickup.created_at.desc())
        )
    ).all()

    return [
        PickupRow(
            id=pickup_id,
            site_name=site_name,
            material=material,
            weight_grams=grams,
            status=pickup_status,
        )
        for pickup_id, site_name, material, grams, pickup_status in rows
    ]


@router.post(
    "/{organisation_id}/pickups/{pickup_id}/{new_status}",
    response_model=PickupRow,
)
async def update_pickup_status(
    organisation_id: uuid.UUID,
    pickup_id: uuid.UUID,
    new_status: str,
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> PickupRow:
    """Advance a pickup through its lifecycle: ready, accepted, completed, cancelled."""
    await _require_org_manager(db, user.id, organisation_id)

    allowed = {"ready", "accepted", "completed", "cancelled"}
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Status must be one of: {', '.join(sorted(allowed))}",
        )

    pickup = await db.scalar(
        select(Pickup)
        .join(ConserveSite, ConserveSite.id == Pickup.site_id)
        .where(Pickup.id == pickup_id, ConserveSite.organisation_id == organisation_id)
    )
    if pickup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pickup not found")

    pickup.status = new_status
    await db.commit()

    site = await db.get(ConserveSite, pickup.site_id)
    material = await db.get(Material, pickup.material_id)
    return PickupRow(
        id=pickup.id,
        site_name=site.name if site else "",
        material=material.name if material else "",
        weight_grams=pickup.weight_grams,
        status=pickup.status,
    )


def kilograms(grams: int) -> float:
    """Convert stored grams to kilograms for display."""
    return grams / GRAMS_PER_KILOGRAM
