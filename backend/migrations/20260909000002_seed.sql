-- Demo recycling network. Plastic is the first active priced material.
-- Additional materials exist so the domain is not plastic-shaped.

INSERT INTO organisations (id, name, slug)
VALUES (
    '00000000-0000-7000-8000-000000000001',
    'Recycle Lagos',
    'recycle-lagos'
);

INSERT INTO materials (id, name, slug, unit, active) VALUES
    ('00000000-0000-7000-8000-000000000010', 'Plastic', 'plastic', 'kg', true),
    ('00000000-0000-7000-8000-000000000011', 'Glass', 'glass', 'kg', true),
    ('00000000-0000-7000-8000-000000000012', 'Paper', 'paper', 'kg', true),
    ('00000000-0000-7000-8000-000000000013', 'Metal', 'metal', 'kg', true),
    ('00000000-0000-7000-8000-000000000014', 'E-waste', 'e-waste', 'kg', false);

-- Current prices. Historical deposits snapshot the row used at confirmation.
INSERT INTO material_prices (
    organisation_id, material_id, price_per_kg_naira, effective_from
) VALUES
    ('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000010', 100, now()),
    ('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000011', 80, now()),
    ('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000012', 120, now()),
    ('00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000013', 500, now());

INSERT INTO collection_points (
    id, organisation_id, name, slug, address, description,
    latitude, longitude, status, default_pickup_threshold_grams
) VALUES
    (
        '00000000-0000-7000-8000-000000000021',
        '00000000-0000-7000-8000-000000000001',
        'Lekki Collection Point',
        'lekki',
        'Admiralty Way, Lekki Phase 1, Lagos',
        'Open daily. Plastic bins are on the courtyard side.',
        6.4474, 3.4721, 'active', 5000
    ),
    (
        '00000000-0000-7000-8000-000000000022',
        '00000000-0000-7000-8000-000000000001',
        'Yaba Collection Point',
        'yaba',
        'Herbert Macaulay Road, Yaba, Lagos',
        'Next to the campus gate. Staffed mornings and evenings.',
        6.5095, 3.3711, 'active', 5000
    );

INSERT INTO collection_point_materials (
    collection_point_id, material_id, pickup_threshold_grams
) VALUES
    ('00000000-0000-7000-8000-000000000021', '00000000-0000-7000-8000-000000000010', 5000),
    ('00000000-0000-7000-8000-000000000022', '00000000-0000-7000-8000-000000000010', 5000);

INSERT INTO collection_point_inventory (
    collection_point_id, material_id, weight_grams
) VALUES
    ('00000000-0000-7000-8000-000000000021', '00000000-0000-7000-8000-000000000010', 0),
    ('00000000-0000-7000-8000-000000000022', '00000000-0000-7000-8000-000000000010', 0);

-- Local/dev device key: cn-dev-lekki-device-key
-- sha256 = 85344d96d8e4714e5116c41f8e8772a77a978c0b65a1cb7d0917734d789d285f
INSERT INTO devices (
    id, organisation_id, collection_point_id, external_id, device_type,
    status, api_key_hash, firmware_version, latitude, longitude
) VALUES (
    '00000000-0000-7000-8000-000000000031',
    '00000000-0000-7000-8000-000000000001',
    '00000000-0000-7000-8000-000000000021',
    'lekki-bin-01',
    'bin_scale',
    'active',
    '85344d96d8e4714e5116c41f8e8772a77a978c0b65a1cb7d0917734d789d285f',
    'sim-0.1.0',
    6.4474,
    3.4721
);
