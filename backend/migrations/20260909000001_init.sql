CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Identity (Better Auth + app profile share this table)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    email_verified_at TIMESTAMPTZ,
    green_points_balance BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_green_points_non_negative CHECK (green_points_balance >= 0)
);

CREATE UNIQUE INDEX users_email_unique ON users (email);

CREATE OR REPLACE FUNCTION users_sync_email_verified()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.email_verified_at IS NOT NULL THEN
        NEW.email_verified := true;
    ELSIF NEW.email_verified THEN
        NEW.email_verified_at := COALESCE(NEW.email_verified_at, now());
    ELSE
        NEW.email_verified_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_sync_email_verified
    BEFORE INSERT OR UPDATE OF email_verified, email_verified_at
    ON users
    FOR EACH ROW
    EXECUTE FUNCTION users_sync_email_verified();

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role),
    CONSTRAINT user_roles_known CHECK (
        role IN ('citizen', 'organisation_member', 'collector', 'admin')
    )
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expires_at TIMESTAMPTZ NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    password TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider_id, account_id)
);

CREATE TABLE verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE jwks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    alg TEXT,
    crv TEXT
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX accounts_user_id_idx ON accounts (user_id);
CREATE INDEX verifications_identifier_idx ON verifications (identifier);

-- Recycling organisations
CREATE TABLE organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug CITEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organisation_members (
    organisation_id UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    member_role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organisation_id, user_id),
    CONSTRAINT organisation_members_role CHECK (member_role IN ('member', 'admin'))
);

-- Materials are data, not code branches
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug CITEXT NOT NULL UNIQUE,
    unit TEXT NOT NULL DEFAULT 'kg',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE material_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
    price_per_kg_naira BIGINT NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT material_prices_non_negative CHECK (price_per_kg_naira >= 0)
);

CREATE INDEX material_prices_lookup_idx
    ON material_prices (organisation_id, material_id, effective_from DESC);

CREATE TABLE collection_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug CITEXT NOT NULL,
    address TEXT NOT NULL,
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT NOT NULL DEFAULT 'active',
    default_pickup_threshold_grams BIGINT NOT NULL DEFAULT 10000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organisation_id, slug),
    CONSTRAINT collection_points_status CHECK (
        status IN ('active', 'inactive', 'maintenance')
    ),
    CONSTRAINT collection_points_threshold_positive CHECK (default_pickup_threshold_grams > 0)
);

CREATE TABLE collection_point_materials (
    collection_point_id UUID NOT NULL REFERENCES collection_points (id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
    pickup_threshold_grams BIGINT,
    PRIMARY KEY (collection_point_id, material_id)
);

CREATE TABLE collection_point_inventory (
    collection_point_id UUID NOT NULL REFERENCES collection_points (id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
    weight_grams BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (collection_point_id, material_id),
    CONSTRAINT inventory_non_negative CHECK (weight_grams >= 0)
);

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
    collection_point_id UUID REFERENCES collection_points (id) ON DELETE SET NULL,
    external_id TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'bin_scale',
    status TEXT NOT NULL DEFAULT 'active',
    api_key_hash TEXT NOT NULL,
    firmware_version TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organisation_id, external_id),
    CONSTRAINT devices_status CHECK (status IN ('active', 'disabled'))
);

CREATE UNIQUE INDEX devices_api_key_hash_unique ON devices (api_key_hash);

CREATE TABLE device_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    payload JSONB NOT NULL
);

CREATE INDEX device_telemetry_device_recorded_idx
    ON device_telemetry (device_id, recorded_at DESC);

CREATE TABLE device_bin_state (
    device_id UUID NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
    weight_grams BIGINT NOT NULL,
    fill_percent INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (device_id, material_id)
);

CREATE TABLE deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    collection_point_id UUID NOT NULL REFERENCES collection_points (id),
    organisation_id UUID NOT NULL REFERENCES organisations (id),
    material_id UUID NOT NULL REFERENCES materials (id),
    device_id UUID REFERENCES devices (id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending_measurement',
    weight_grams BIGINT,
    price_per_kg_naira BIGINT,
    green_points BIGINT,
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    measured_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT deposits_status CHECK (
        status IN ('pending_measurement', 'measured', 'confirmed', 'cancelled')
    )
);

CREATE UNIQUE INDEX deposits_idempotency_key_unique ON deposits (idempotency_key);
CREATE INDEX deposits_user_created_idx ON deposits (user_id, created_at DESC);
CREATE INDEX deposits_org_created_idx ON deposits (organisation_id, created_at DESC);

CREATE TABLE green_point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    entry_type TEXT NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT green_point_transactions_type CHECK (
        entry_type IN ('deposit_reward', 'redemption', 'adjustment')
    )
);

CREATE UNIQUE INDEX green_point_transactions_deposit_unique
    ON green_point_transactions (reference_id)
    WHERE entry_type = 'deposit_reward' AND reference_id IS NOT NULL;

CREATE INDEX green_point_transactions_user_created_idx
    ON green_point_transactions (user_id, created_at DESC);

CREATE TABLE pickups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
    collection_point_id UUID NOT NULL REFERENCES collection_points (id),
    material_id UUID NOT NULL REFERENCES materials (id),
    status TEXT NOT NULL DEFAULT 'ready',
    threshold_grams BIGINT NOT NULL,
    inventory_grams_at_ready BIGINT NOT NULL,
    collected_grams BIGINT,
    accepted_by UUID REFERENCES users (id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pickups_status CHECK (
        status IN ('ready', 'accepted', 'completed', 'cancelled')
    )
);

CREATE UNIQUE INDEX pickups_open_unique
    ON pickups (collection_point_id, material_id)
    WHERE status IN ('ready', 'accepted');

CREATE INDEX pickups_org_status_idx ON pickups (organisation_id, status, created_at DESC);
