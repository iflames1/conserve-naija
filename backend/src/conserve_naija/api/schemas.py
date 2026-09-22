"""Typed HTTP contracts that keep browser intent separate from machine measurements."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from conserve_naija.domain.sessions import SessionStatus


class StartSessionRequest(BaseModel):
    """The browser can start a mission, but cannot provide physical results."""

    model_config = ConfigDict(extra="forbid")


class SessionResponse(BaseModel):
    id: uuid.UUID
    status: SessionStatus
    otp: str | None = None
    otp_expires_at: datetime | None = None


class SiteResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    address: str
    status: str
    latitude: float | None
    longitude: float | None
    accepted_materials: list[str]


class DeviceResponse(BaseModel):
    id: uuid.UUID
    external_id: str
    site_id: uuid.UUID | None
    status: str
    last_seen_at: datetime | None


class HeartbeatRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    firmware_version: str | None = None


class TelemetryBin(BaseModel):
    material: str
    weight_kg: float
    fill_percent: int | None = Field(default=None, ge=0, le=100)


class TelemetryRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    bins: list[TelemetryBin] = Field(min_length=1, max_length=32)


class ClaimSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(pattern=r"^\d{6}$")


class ProgressRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage: str = Field(pattern="^sorting$")


class MeasurementFraction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    material: str = Field(min_length=1, max_length=120)
    weight_kg: float = Field(gt=0, le=10_000)


class MeasurementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fractions: list[MeasurementFraction] = Field(min_length=1, max_length=32)


class DepositResult(BaseModel):
    deposit_id: uuid.UUID
    conserve_points: int
    fractions: list[dict[str, int | str]]
    status: str
