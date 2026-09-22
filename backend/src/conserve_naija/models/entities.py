"""Core persistence models for the recycling loop."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from conserve_naija.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from conserve_naija.domain.sessions import SessionStatus


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(160), default="")
    password_hash: Mapped[str | None] = mapped_column(String(255))
    roles: Mapped[list[UserRole]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserRole(Base):
    __tablename__ = "user_roles"
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(40), primary_key=True)
    user: Mapped[User] = relationship(back_populates="roles")


class Organisation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organisations"

    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    members: Mapped[list[OrganisationMember]] = relationship(
        back_populates="organisation", cascade="all, delete-orphan"
    )
    sites: Mapped[list[ConserveSite]] = relationship(
        back_populates="organisation", cascade="all, delete-orphan"
    )


class OrganisationMember(Base):
    __tablename__ = "organisation_members"
    organisation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organisations.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(40), default="member")
    organisation: Mapped[Organisation] = relationship(back_populates="members")


class Material(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "materials"

    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    prices: Mapped[list[MaterialPrice]] = relationship(
        back_populates="material", cascade="all, delete-orphan"
    )


class MaterialPrice(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "material_prices"
    __table_args__ = (
        Index("ix_material_prices_lookup", "organisation_id", "material_id", "effective_from"),
    )

    organisation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organisations.id", ondelete="CASCADE")
    )
    material_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("materials.id", ondelete="CASCADE"))
    price_per_kg_naira: Mapped[int] = mapped_column(BigInteger)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    material: Mapped[Material] = relationship(back_populates="prices")
    __table_args__ = (
        CheckConstraint("price_per_kg_naira >= 0", name="price_non_negative"),
        Index("ix_material_prices_lookup", "organisation_id", "material_id", "effective_from"),
    )


class ConserveSite(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "conserve_sites"
    __table_args__ = (UniqueConstraint("organisation_id", "slug"),)

    organisation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organisations.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(160))
    address: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="active")
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    default_pickup_threshold_grams: Mapped[int] = mapped_column(BigInteger, default=10_000)
    organisation: Mapped[Organisation] = relationship(back_populates="sites")
    machines: Mapped[list[Machine]] = relationship(back_populates="site")
    materials: Mapped[list[SiteMaterial]] = relationship(
        back_populates="site", cascade="all, delete-orphan"
    )
    inventory: Mapped[list[SiteInventory]] = relationship(
        back_populates="site", cascade="all, delete-orphan"
    )


class SiteMaterial(Base):
    __tablename__ = "site_materials"
    site_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conserve_sites.id", ondelete="CASCADE"), primary_key=True
    )
    material_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("materials.id", ondelete="CASCADE"), primary_key=True
    )
    pickup_threshold_grams: Mapped[int | None] = mapped_column(BigInteger)
    site: Mapped[ConserveSite] = relationship(back_populates="materials")


class Machine(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "machines"
    __table_args__ = (UniqueConstraint("organisation_id", "external_id"),)

    organisation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organisations.id", ondelete="CASCADE")
    )
    site_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("conserve_sites.id", ondelete="SET NULL")
    )
    external_id: Mapped[str] = mapped_column(String(120))
    credential_hash: Mapped[str] = mapped_column(String(255), unique=True)
    status: Mapped[str] = mapped_column(String(30), default="active")
    firmware_version: Mapped[str | None] = mapped_column(String(80))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    site: Mapped[ConserveSite | None] = relationship(back_populates="machines")


class RecyclingSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "recycling_sessions"
    __table_args__ = (Index("ix_recycling_sessions_active_otp", "otp_digest", "status"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    machine_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("machines.id", ondelete="SET NULL")
    )
    site_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("conserve_sites.id", ondelete="SET NULL")
    )
    otp_digest: Mapped[str] = mapped_column(String(64), unique=True)
    otp_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    otp_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[SessionStatus] = mapped_column(
        String(40), default=SessionStatus.WAITING_FOR_MACHINE
    )
    deposits: Mapped[list[Deposit]] = relationship(back_populates="session")


class Deposit(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "deposits"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recycling_sessions.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"))
    site_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conserve_sites.id"))
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True)
    status: Mapped[str] = mapped_column(String(30), default="confirmed")
    fractions: Mapped[list[DepositFraction]] = relationship(
        back_populates="deposit", cascade="all, delete-orphan"
    )
    session: Mapped[RecyclingSession] = relationship(back_populates="deposits")


class DepositFraction(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "deposit_fractions"
    __table_args__ = (UniqueConstraint("deposit_id", "material_id"),)

    deposit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("deposits.id", ondelete="CASCADE"))
    material_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("materials.id"))
    weight_grams: Mapped[int] = mapped_column(BigInteger)
    price_per_kg_naira: Mapped[int] = mapped_column(BigInteger)
    conserve_points: Mapped[int] = mapped_column(BigInteger)
    deposit: Mapped[Deposit] = relationship(back_populates="fractions")


class CpLedgerEntry(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "cp_ledger_entries"
    __table_args__ = (UniqueConstraint("deposit_id", name="uq_cp_ledger_entries_deposit_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    deposit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("deposits.id", ondelete="CASCADE"))
    amount: Mapped[int] = mapped_column(BigInteger)
    entry_type: Mapped[str] = mapped_column(String(30), default="deposit_reward")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SiteInventory(Base):
    __tablename__ = "site_inventory"
    site_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conserve_sites.id", ondelete="CASCADE"), primary_key=True
    )
    material_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("materials.id", ondelete="CASCADE"), primary_key=True
    )
    weight_grams: Mapped[int] = mapped_column(BigInteger, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    site: Mapped[ConserveSite] = relationship(back_populates="inventory")


class Pickup(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "pickups"
    site_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conserve_sites.id", ondelete="CASCADE"))
    material_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("materials.id"))
    weight_grams: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(30), default="ready")


class MachineTelemetry(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "machine_telemetry"
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id", ondelete="CASCADE"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    payload: Mapped[dict] = mapped_column(JSON)
