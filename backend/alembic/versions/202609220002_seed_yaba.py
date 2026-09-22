"""Seed the single public Conserve Site and development machine."""

import os
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa

from alembic import op

revision: str = "202609220002"
down_revision: str | Sequence[str] | None = "a945b2625cf8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ORG_ID = "00000000-0000-7000-8000-000000000001"
SITE_ID = "00000000-0000-7000-8000-000000000022"
USER_ID = "00000000-0000-7000-8000-000000000002"
MACHINE_ID = "00000000-0000-7000-8000-000000000031"
MATERIAL_IDS = [
    "00000000-0000-7000-8000-000000000010",
    "00000000-0000-7000-8000-000000000011",
    "00000000-0000-7000-8000-000000000012",
    "00000000-0000-7000-8000-000000000013",
]


def _seed_demo_citizen() -> bool:
    """Whether to create the demo account.

    The demo citizen has a published password, so it must never exist outside
    local development. Production accounts are created through sign-up.
    """
    return os.getenv("ENVIRONMENT", "local").lower() not in {"production", "prod"}


def _table(name: str, *columns: sa.ColumnClause) -> sa.TableClause:
    return sa.table(name, *columns)


def upgrade() -> None:
    now = datetime.now(UTC)
    organisations = _table(
        "organisations",
        sa.column("id"),
        sa.column("name"),
        sa.column("slug"),
        sa.column("created_at"),
        sa.column("updated_at"),
    )
    users = _table(
        "users",
        sa.column("id"),
        sa.column("email"),
        sa.column("display_name"),
        sa.column("password_hash"),
        sa.column("created_at"),
        sa.column("updated_at"),
    )
    roles = _table("user_roles", sa.column("user_id"), sa.column("role"), sa.column("created_at"))
    members = _table(
        "organisation_members",
        sa.column("organisation_id"),
        sa.column("user_id"),
        sa.column("role"),
        sa.column("created_at"),
    )
    sites = _table(
        "conserve_sites",
        sa.column("id"),
        sa.column("organisation_id"),
        sa.column("name"),
        sa.column("slug"),
        sa.column("address"),
        sa.column("status"),
        sa.column("latitude"),
        sa.column("longitude"),
        sa.column("default_pickup_threshold_grams"),
        sa.column("created_at"),
        sa.column("updated_at"),
    )
    materials = _table(
        "materials",
        sa.column("id"),
        sa.column("name"),
        sa.column("slug"),
        sa.column("active"),
        sa.column("created_at"),
        sa.column("updated_at"),
    )
    prices = _table(
        "material_prices",
        sa.column("id"),
        sa.column("organisation_id"),
        sa.column("material_id"),
        sa.column("price_per_kg_naira"),
        sa.column("effective_from"),
        sa.column("created_at"),
        sa.column("updated_at"),
    )
    accepted = _table(
        "site_materials",
        sa.column("site_id"),
        sa.column("material_id"),
        sa.column("pickup_threshold_grams"),
    )
    inventory = _table(
        "site_inventory",
        sa.column("site_id"),
        sa.column("material_id"),
        sa.column("weight_grams"),
        sa.column("updated_at"),
    )
    machines = _table(
        "machines",
        sa.column("id"),
        sa.column("organisation_id"),
        sa.column("site_id"),
        sa.column("external_id"),
        sa.column("credential_hash"),
        sa.column("status"),
        sa.column("created_at"),
        sa.column("updated_at"),
    )

    op.bulk_insert(
        organisations,
        [
            {
                "id": ORG_ID,
                "name": "Conserve Naija",
                "slug": "conserve-naija",
                "created_at": now,
                "updated_at": now,
            }
        ],
    )
    if _seed_demo_citizen():
        op.bulk_insert(
            users,
            [
                {
                    "id": USER_ID,
                    "email": "demo@conserve-naija.local",
                    "display_name": "Demo Citizen",
                    "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$LiZWI8AM+gD/IGHftCNRbQ$ArWZJ3349QXbk/PybBQ9erQlWR5OmqCcgUV4k//6Ezg",
                    "created_at": now,
                    "updated_at": now,
                }
            ],
        )
        op.bulk_insert(roles, [{"user_id": USER_ID, "role": "citizen"}])
        op.bulk_insert(
            members,
            [{"organisation_id": ORG_ID, "user_id": USER_ID, "role": "admin"}],
        )
    op.bulk_insert(
        sites,
        [
            {
                "id": SITE_ID,
                "organisation_id": ORG_ID,
                "name": "Yaba",
                "slug": "yaba",
                "address": "18 Herbert Macaulay Way, Yaba, Lagos",
                "status": "active",
                "latitude": 6.5095,
                "longitude": 3.3711,
                "default_pickup_threshold_grams": 10000,
                "created_at": now,
                "updated_at": now,
            }
        ],
    )
    op.bulk_insert(
        materials,
        [
            {
                "id": material_id,
                "name": name,
                "slug": slug,
                "active": True,
                "created_at": now,
                "updated_at": now,
            }
            for material_id, name, slug in zip(
                MATERIAL_IDS,
                ["Plastic", "Paper & Cardboard", "Glass", "Metal"],
                ["plastic", "paper", "glass", "metal"],
                strict=True,
            )
        ],
    )
    op.bulk_insert(
        prices,
        [
            {
                "id": f"00000000-0000-7000-8000-0000000000{40 + index}",
                "organisation_id": ORG_ID,
                "material_id": material_id,
                "price_per_kg_naira": price,
                "effective_from": now,
                "created_at": now,
                "updated_at": now,
            }
            for index, (material_id, price) in enumerate(
                zip(MATERIAL_IDS, [100, 60, 40, 150], strict=True)
            )
        ],
    )
    op.bulk_insert(
        accepted,
        [
            {
                "site_id": SITE_ID,
                "material_id": material_id,
                "pickup_threshold_grams": 10000 if index == 0 else 5000,
            }
            for index, material_id in enumerate(MATERIAL_IDS)
        ],
    )
    op.bulk_insert(
        inventory,
        [
            {"site_id": SITE_ID, "material_id": material_id, "weight_grams": 0, "updated_at": now}
            for material_id in MATERIAL_IDS
        ],
    )
    op.bulk_insert(
        machines,
        [
            {
                "id": MACHINE_ID,
                "organisation_id": ORG_ID,
                "site_id": SITE_ID,
                "external_id": "CN-MACHINE-001",
                "credential_hash": "$argon2id$v=19$m=65536,t=3,p=4$rmNX2lf26tn9kE+GAhUkAA$JAc2N9dONCroLj44J/gQa3j1sG93o0IEL8EjdC12qo4",
                "status": "active",
                "created_at": now,
                "updated_at": now,
            }
        ],
    )


def downgrade() -> None:
    connection = op.get_bind()
    for table, column, value in [
        ("machines", "id", MACHINE_ID),
        ("site_inventory", "site_id", SITE_ID),
        ("site_materials", "site_id", SITE_ID),
        ("material_prices", "organisation_id", ORG_ID),
        ("materials", "id", MATERIAL_IDS),
        ("organisation_members", "organisation_id", ORG_ID),
        ("user_roles", "user_id", USER_ID),
        ("users", "id", USER_ID),
        ("conserve_sites", "id", SITE_ID),
        ("organisations", "id", ORG_ID),
    ]:
        if isinstance(value, list):
            connection.execute(
                sa.text(f"DELETE FROM {table} WHERE {column} = ANY(:values)"), {"values": value}
            )
        else:
            connection.execute(
                sa.text(f"DELETE FROM {table} WHERE {column} = :value"), {"value": value}
            )
