"""SQLAlchemy model registry."""

from conserve_naija.models.entities import (
    ConserveSite,
    CpLedgerEntry,
    Deposit,
    DepositFraction,
    Machine,
    MachineTelemetry,
    Material,
    MaterialPrice,
    Organisation,
    OrganisationMember,
    Pickup,
    RecyclingSession,
    SiteInventory,
    SiteMaterial,
    User,
    UserRole,
)

__all__ = [
    "ConserveSite",
    "CpLedgerEntry",
    "Deposit",
    "DepositFraction",
    "Machine",
    "MachineTelemetry",
    "Material",
    "MaterialPrice",
    "Organisation",
    "OrganisationMember",
    "Pickup",
    "RecyclingSession",
    "SiteInventory",
    "SiteMaterial",
    "User",
    "UserRole",
]
