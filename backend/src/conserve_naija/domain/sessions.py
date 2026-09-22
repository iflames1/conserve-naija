"""Recycling session state machine."""

from enum import StrEnum


class SessionStatus(StrEnum):
    WAITING_FOR_MACHINE = "waiting_for_machine"
    CONNECTED = "connected"
    SORTING = "sorting"
    MEASURING = "measuring"
    PROCESSING = "processing"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    FAILED = "failed"


_ALLOWED_TRANSITIONS: dict[SessionStatus, frozenset[SessionStatus]] = {
    SessionStatus.WAITING_FOR_MACHINE: frozenset(
        {SessionStatus.CONNECTED, SessionStatus.EXPIRED, SessionStatus.CANCELLED}
    ),
    SessionStatus.CONNECTED: frozenset(
        {SessionStatus.SORTING, SessionStatus.CANCELLED, SessionStatus.FAILED}
    ),
    SessionStatus.SORTING: frozenset(
        {SessionStatus.MEASURING, SessionStatus.CANCELLED, SessionStatus.FAILED}
    ),
    SessionStatus.MEASURING: frozenset(
        {SessionStatus.PROCESSING, SessionStatus.CANCELLED, SessionStatus.FAILED}
    ),
    SessionStatus.PROCESSING: frozenset(
        {SessionStatus.COMPLETED, SessionStatus.CANCELLED, SessionStatus.FAILED}
    ),
    SessionStatus.COMPLETED: frozenset(),
    SessionStatus.EXPIRED: frozenset(),
    SessionStatus.CANCELLED: frozenset(),
    SessionStatus.FAILED: frozenset(),
}


def can_transition(current: SessionStatus, target: SessionStatus) -> bool:
    """Return whether a session can move to the target state."""
    return target in _ALLOWED_TRANSITIONS[current]


def transition(current: SessionStatus, target: SessionStatus) -> SessionStatus:
    """Move a session or raise a domain error for an invalid transition."""
    if not can_transition(current, target):
        raise ValueError(f"cannot transition session from {current} to {target}")
    return target
