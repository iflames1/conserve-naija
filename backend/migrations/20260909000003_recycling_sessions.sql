-- Temporary recycling missions. Distinct from Better Auth `sessions`.
CREATE TABLE recycling_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting_for_machine',
    device_id UUID REFERENCES devices (id),
    collection_point_id UUID REFERENCES collection_points (id),
    organisation_id UUID REFERENCES organisations (id),
    material_id UUID REFERENCES materials (id),
    deposit_id UUID REFERENCES deposits (id),
    failure_reason TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    connected_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT recycling_sessions_status CHECK (
        status IN (
            'waiting_for_machine',
            'connected',
            'measuring',
            'processing',
            'completed',
            'expired',
            'cancelled',
            'failed'
        )
    ),
    CONSTRAINT recycling_sessions_code_shape CHECK (code ~ '^[0-9]{6}$')
);

CREATE UNIQUE INDEX recycling_sessions_open_code
    ON recycling_sessions (code)
    WHERE status IN ('waiting_for_machine', 'connected', 'measuring', 'processing');

CREATE INDEX recycling_sessions_user_created
    ON recycling_sessions (user_id, created_at DESC);

CREATE INDEX recycling_sessions_device
    ON recycling_sessions (device_id, created_at DESC);

ALTER TABLE deposits
    ADD COLUMN session_id UUID REFERENCES recycling_sessions (id);

CREATE UNIQUE INDEX deposits_session_unique
    ON deposits (session_id)
    WHERE session_id IS NOT NULL;

