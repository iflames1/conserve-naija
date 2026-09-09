-- Demo machine for the Yaba walk-up flow. Key: cn-dev-yaba-device-key
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
ON CONFLICT (id) DO NOTHING;
