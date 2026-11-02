CREATE TABLE email_auth_codes (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id),
    purpose varchar(20) NOT NULL CHECK (purpose IN ('EMAIL_VERIFY', 'PASSWORD_RESET')),
    code_hash varchar(512) NOT NULL,
    failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX one_active_email_code ON email_auth_codes(user_id, purpose)
    WHERE consumed_at IS NULL AND revoked_at IS NULL;
