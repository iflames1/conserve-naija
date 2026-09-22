"""Typed HTTP contracts that keep browser intent separate from machine measurements.

Two naming conventions meet here. The browser speaks snake_case like the rest of
the Python code. The IoT machine speaks camelCase, matching its ESP32 firmware and
the original device protocol, so the machine-facing schemas accept camelCase on
the way in and reply in camelCase on the way out. Accepting both spellings means a
firmware image already running in the field keeps working.
"""

import uuid
from datetime import datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

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
    firmware_version: str | None = Field(
        default=None,
        validation_alias=AliasChoices("firmware_version", "firmwareVersion"),
    )


class TelemetryBin(BaseModel):
    material: str
    weight_kg: float = Field(validation_alias=AliasChoices("weight_kg", "weightKg"))
    fill_percent: int | None = Field(
        default=None,
        ge=0,
        le=100,
        validation_alias=AliasChoices("fill_percent", "fillPercent"),
    )


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
    weight_kg: float = Field(
        gt=0, le=10_000, validation_alias=AliasChoices("weight_kg", "weightKg")
    )


class MeasurementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fractions: list[MeasurementFraction] = Field(min_length=1, max_length=32)


class MachineFraction(BaseModel):
    """A measured fraction, in the machine's camelCase protocol."""

    material: str
    weight_grams: int = Field(serialization_alias="weightGrams")
    conserve_points: int = Field(serialization_alias="conservePoints")


class MachineDepositResult(BaseModel):
    """The confirmed deposit as the machine receives it.

    The machine displays its own result, so these values must be readable with
    the same camelCase keys the firmware already uses.
    """

    model_config = ConfigDict(populate_by_name=True)

    deposit_id: uuid.UUID = Field(serialization_alias="depositId")
    conserve_points: int = Field(serialization_alias="conservePoints")
    fractions: list[MachineFraction]
    status: str
