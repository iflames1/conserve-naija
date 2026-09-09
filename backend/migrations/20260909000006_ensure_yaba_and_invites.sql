-- Prod may have missed earlier seeds. Yaba is the public walk-up machine.
-- Pending org invites let an admin add an email before that person signs up.

CREATE TABLE IF NOT EXISTS organisation_invitations (
    organisation_id UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
    email CITEXT NOT NULL,
    member_role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organisation_id, email),
    CONSTRAINT organisation_invitations_role CHECK (member_role IN ('member', 'admin'))
);

INSERT INTO organisations (id, name, slug)
VALUES (
    '00000000-0000-7000-8000-000000000001',
    'Recycle Lagos',
    'recycle-lagos'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO materials (id, name, slug, unit, active) VALUES
    ('00000000-0000-7000-8000-000000000010', 'Plastic', 'plastic', 'kg', true)
ON CONFLICT (id) DO UPDATE SET active = true;

INSERT INTO collection_points (
    id, organisation_id, name, slug, address, description,
    latitude, longitude, status, default_pickup_threshold_grams
) VALUES (
    '00000000-0000-7000-8000-000000000022',
    '00000000-0000-7000-8000-000000000001',
    'Yaba Collection Point',
    'yaba',
    'Herbert Macaulay Road, Yaba, Lagos',
    'Next to the campus gate. Staffed mornings and evenings.',
    6.5095, 3.3711, 'active', 5000
)
ON CONFLICT (id) DO UPDATE SET
    status = 'active',
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    address = EXCLUDED.address,
    updated_at = now();

INSERT INTO material_prices (
    organisation_id, material_id, price_per_kg_naira, effective_from
)
SELECT
    '00000000-0000-7000-8000-000000000001',
    '00000000-0000-7000-8000-000000000010',
    100,
    now()
WHERE NOT EXISTS (
    SELECT 1
    FROM material_prices
    WHERE organisation_id = '00000000-0000-7000-8000-000000000001'
      AND material_id = '00000000-0000-7000-8000-000000000010'
);

INSERT INTO collection_point_materials (
    collection_point_id, material_id, pickup_threshold_grams
) VALUES (
    '00000000-0000-7000-8000-000000000022',
    '00000000-0000-7000-8000-000000000010',
    5000
)
ON CONFLICT (collection_point_id, material_id) DO NOTHING;

INSERT INTO collection_point_inventory (
    collection_point_id, material_id, weight_grams
) VALUES (
    '00000000-0000-7000-8000-000000000022',
    '00000000-0000-7000-8000-000000000010',
    0
)
ON CONFLICT (collection_point_id, material_id) DO NOTHING;

INSERT INTO devices (
    id, organisation_id, collection_point_id, external_id, device_type,
    status, api_key_hash, firmware_version, latitude, longitude
) VALUES (
    '00000000-0000-7000-8000-000000000032',
    '00000000-0000-7000-8000-000000000001',
    '00000000-0000-7000-8000-000000000022',
    'CN-MACHINE-001',
    'bin_scale',
    'active',
    '922fe1bee6cf6250b0a92fcd9cdf525789d62711aac740d8e8229a0126b62e9e',
    'wokwi-0.2.0',
    6.5095,
    3.3711
)
ON CONFLICT (id) DO UPDATE SET
    status = 'active',
    collection_point_id = EXCLUDED.collection_point_id,
    api_key_hash = EXCLUDED.api_key_hash;

UPDATE devices
SET
    status = 'active',
    collection_point_id = '00000000-0000-7000-8000-000000000022'
WHERE organisation_id = '00000000-0000-7000-8000-000000000001'
  AND external_id = 'CN-MACHINE-001';

UPDATE collection_points
SET status = 'inactive', updated_at = now()
WHERE id = '00000000-0000-7000-8000-000000000021';

UPDATE devices
SET status = 'disabled'
WHERE id = '00000000-0000-7000-8000-000000000031';
