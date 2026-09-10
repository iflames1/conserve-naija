-- Product model: Conserve Site (collection_points stay the table),
-- deposit material fractions, Yaba as the public site, mixed-waste materials.

CREATE TABLE IF NOT EXISTS deposit_fractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deposit_id UUID NOT NULL REFERENCES deposits (id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials (id),
    weight_grams BIGINT NOT NULL CHECK (weight_grams > 0),
    price_per_kg_naira BIGINT NOT NULL CHECK (price_per_kg_naira >= 0),
    green_points BIGINT NOT NULL CHECK (green_points >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (deposit_id, material_id)
);

CREATE INDEX IF NOT EXISTS deposit_fractions_deposit_idx ON deposit_fractions (deposit_id);

ALTER TABLE recycling_sessions DROP CONSTRAINT recycling_sessions_status;
ALTER TABLE recycling_sessions ADD CONSTRAINT recycling_sessions_status CHECK (
    status IN (
        'waiting_for_machine',
        'connected',
        'sorting',
        'measuring',
        'processing',
        'completed',
        'expired',
        'cancelled',
        'failed'
    )
);

DROP INDEX IF EXISTS recycling_sessions_open_code;
CREATE UNIQUE INDEX recycling_sessions_open_code
    ON recycling_sessions (code)
    WHERE status IN ('waiting_for_machine', 'connected', 'sorting', 'measuring', 'processing');

UPDATE collection_points
SET name = 'Yaba', updated_at = now()
WHERE slug = 'yaba';

UPDATE collection_points
SET name = 'Lekki', status = 'inactive', updated_at = now()
WHERE slug = 'lekki';

-- Public walk-up is Yaba only. Tests may reactivate Lekki for IoT.
UPDATE devices
SET status = 'disabled'
WHERE id = '00000000-0000-7000-8000-000000000031';

UPDATE materials
SET name = 'Paper & Cardboard'
WHERE slug = 'paper';

-- Current prices (snapshot on deposit; history rows stay).
INSERT INTO material_prices (organisation_id, material_id, price_per_kg_naira, effective_from)
SELECT '00000000-0000-7000-8000-000000000001', id, price, now()
FROM (VALUES
    ('00000000-0000-7000-8000-000000000010'::uuid, 100),
    ('00000000-0000-7000-8000-000000000011'::uuid, 40),
    ('00000000-0000-7000-8000-000000000012'::uuid, 60),
    ('00000000-0000-7000-8000-000000000013'::uuid, 150)
) AS t(id, price);

-- Yaba accepts the active recyclable streams (plastic was already attached).
INSERT INTO collection_point_materials (collection_point_id, material_id, pickup_threshold_grams)
VALUES
    ('00000000-0000-7000-8000-000000000022', '00000000-0000-7000-8000-000000000011', 5000),
    ('00000000-0000-7000-8000-000000000022', '00000000-0000-7000-8000-000000000012', 5000),
    ('00000000-0000-7000-8000-000000000022', '00000000-0000-7000-8000-000000000013', 5000)
ON CONFLICT (collection_point_id, material_id) DO NOTHING;

INSERT INTO collection_point_inventory (collection_point_id, material_id, weight_grams)
VALUES
    ('00000000-0000-7000-8000-000000000022', '00000000-0000-7000-8000-000000000011', 0),
    ('00000000-0000-7000-8000-000000000022', '00000000-0000-7000-8000-000000000012', 0),
    ('00000000-0000-7000-8000-000000000022', '00000000-0000-7000-8000-000000000013', 0)
ON CONFLICT (collection_point_id, material_id) DO NOTHING;
