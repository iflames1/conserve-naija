"""Identity helpers that keep platform roles in sync with configuration."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from conserve_naija.config import get_settings
from conserve_naija.models import Organisation, OrganisationMember, User, UserRole

PLATFORM_ADMIN_ROLE = "admin"
CITIZEN_ROLE = "citizen"
ORGANISATION_MEMBER_ROLE = "organisation_member"
ORGANISATION_ADMIN_ROLE = "admin"


def is_configured_admin(email: str) -> bool:
    """Return whether the email is listed in ``ADMIN_EMAILS``."""
    return email.strip().lower() in set(get_settings().admin_emails)


async def user_roles(db: AsyncSession, user_id: uuid.UUID) -> set[str]:
    """Return every role held by a user."""
    rows = await db.scalars(select(UserRole.role).where(UserRole.user_id == user_id))
    return set(rows.all())


async def sync_platform_admin(db: AsyncSession, user: User) -> None:
    """Grant configured administrators their role and organisation membership.

    Runs on sign-up and sign-in so adding an email to ``ADMIN_EMAILS`` takes
    effect without a migration or a manual database edit.
    """
    if not is_configured_admin(user.email):
        return

    roles = await user_roles(db, user.id)
    if CITIZEN_ROLE not in roles:
        db.add(UserRole(user_id=user.id, role=CITIZEN_ROLE))
    if PLATFORM_ADMIN_ROLE not in roles:
        db.add(UserRole(user_id=user.id, role=PLATFORM_ADMIN_ROLE))

    organisation = await db.scalar(select(Organisation).order_by(Organisation.created_at))
    if organisation is not None:
        membership = await db.scalar(
            select(OrganisationMember).where(
                OrganisationMember.organisation_id == organisation.id,
                OrganisationMember.user_id == user.id,
            )
        )
        if membership is None:
            db.add(
                OrganisationMember(
                    organisation_id=organisation.id,
                    user_id=user.id,
                    role=ORGANISATION_ADMIN_ROLE,
                )
            )
        elif membership.role != ORGANISATION_ADMIN_ROLE:
            membership.role = ORGANISATION_ADMIN_ROLE

    await db.commit()
