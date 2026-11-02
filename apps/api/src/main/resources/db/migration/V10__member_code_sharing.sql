CREATE TABLE member_codes (
    code varchar(8) PRIMARY KEY CHECK (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'),
    user_id uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL,
    revoked_at timestamptz
);
CREATE UNIQUE INDEX one_current_member_code ON member_codes(user_id) WHERE revoked_at IS NULL;
CREATE TABLE sharing_requests (
    id uuid PRIMARY KEY,
    requester_id uuid NOT NULL REFERENCES users(id),
    recipient_id uuid NOT NULL REFERENCES users(id),
    status varchar(12) NOT NULL CHECK (status IN ('PENDING','ACCEPTED','REJECTED','CANCELLED','EXPIRED')),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    decided_at timestamptz,
    shared_space_id uuid REFERENCES spaces(id),
    CHECK (requester_id <> recipient_id),
    CHECK ((status = 'ACCEPTED') = (shared_space_id IS NOT NULL))
);
CREATE UNIQUE INDEX one_pending_pair ON sharing_requests(LEAST(requester_id,recipient_id),GREATEST(requester_id,recipient_id)) WHERE status='PENDING';
CREATE INDEX sharing_requests_inbox ON sharing_requests(recipient_id,created_at DESC);
CREATE INDEX sharing_requests_outbox ON sharing_requests(requester_id,created_at DESC);
CREATE TABLE sharing_connections (
    space_id uuid PRIMARY KEY REFERENCES spaces(id),
    first_user_id uuid NOT NULL UNIQUE REFERENCES users(id),
    second_user_id uuid NOT NULL UNIQUE REFERENCES users(id),
    started_at timestamptz NOT NULL,
    CHECK (first_user_id <> second_user_id)
);
CREATE TABLE private_space_archives (
    space_id uuid PRIMARY KEY REFERENCES spaces(id),
    user_id uuid NOT NULL REFERENCES users(id),
    archived_at timestamptz NOT NULL,
    shared_space_id uuid NOT NULL REFERENCES spaces(id)
);
-- An in-flight write must finish before archiving or fail, never write into past private history afterward.
CREATE FUNCTION protect_archived_financial_space() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_status varchar(20);
BEGIN
    SELECT status INTO current_status FROM spaces WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.space_id ELSE NEW.space_id END FOR SHARE;
    IF current_status IS DISTINCT FROM 'ACTIVE' THEN
        RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Space changed; reload the current workspace before writing';
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
DO $$
DECLARE relation_name text;
BEGIN
    FOREACH relation_name IN ARRAY ARRAY['categories','expense_subcategories','payment_methods','recurring_expenses','recurring_expense_revisions','scheduled_charges','transactions','incomes','savings'] LOOP
        EXECUTE format('CREATE TRIGGER guard_archived_space BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION protect_archived_financial_space()',relation_name);
    END LOOP;
END;
$$;
