-- Pending accounts have no password until the mailbox owner follows the verification link.
-- Preserve existing credentials and tokens; completing any pending signup sets a new password.
ALTER TABLE password_credentials ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE password_credentials ALTER COLUMN password_changed_at DROP NOT NULL;
ALTER TABLE password_credentials ADD CONSTRAINT verified_account_has_password
    CHECK (email_verified_at IS NULL OR (password_hash IS NOT NULL AND password_changed_at IS NOT NULL));
ALTER TABLE password_credentials ADD CONSTRAINT password_has_change_timestamp
    CHECK ((password_hash IS NULL) = (password_changed_at IS NULL));
