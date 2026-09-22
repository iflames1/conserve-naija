"""create core schema

Revision ID: a945b2625cf8
Revises:
Create Date: 2026-09-22 04:14:16.070902
"""

from collections.abc import Sequence

from alembic import op
from conserve_naija import models  # noqa: F401
from conserve_naija.db.base import Base

revision: str = "a945b2625cf8"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
