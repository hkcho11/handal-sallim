ALTER TABLE sharing_connections ADD COLUMN ended_at timestamptz;
ALTER TABLE sharing_connections DROP CONSTRAINT sharing_connections_first_user_id_key;
ALTER TABLE sharing_connections DROP CONSTRAINT sharing_connections_second_user_id_key;
CREATE UNIQUE INDEX one_current_first_connection ON sharing_connections(first_user_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX one_current_second_connection ON sharing_connections(second_user_id) WHERE ended_at IS NULL;

CREATE TABLE sharing_disconnect_requests (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES sharing_connections(space_id),
    requester_id uuid NOT NULL REFERENCES users(id),
    recipient_id uuid NOT NULL REFERENCES users(id),
    status varchar(12) NOT NULL CHECK (status IN ('PENDING','ACCEPTED','REJECTED','CANCELLED','EXPIRED')),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    decided_at timestamptz,
    CHECK (requester_id <> recipient_id)
);
CREATE UNIQUE INDEX one_pending_disconnect ON sharing_disconnect_requests(space_id) WHERE status='PENDING';

CREATE TABLE shared_space_archives (
    space_id uuid NOT NULL REFERENCES sharing_connections(space_id),
    user_id uuid NOT NULL REFERENCES users(id),
    archived_at timestamptz NOT NULL,
    PRIMARY KEY (space_id,user_id)
);
