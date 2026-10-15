CREATE TABLE transactions (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES spaces(id),
    created_by uuid NOT NULL,
    creation_key uuid,
    creation_fingerprint varchar(64),
    name varchar(120),
    type varchar(20) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    amount bigint NOT NULL CHECK (amount BETWEEN 1 AND 9007199254740991),
    occurred_on date NOT NULL,
    category_id uuid,
    payment_method_id uuid NOT NULL,
    memo varchar(500),
    visibility varchar(20) NOT NULL CHECK (visibility IN ('SHARED', 'PRIVATE')),
    source varchar(20) NOT NULL CHECK (source IN ('MANUAL', 'SCHEDULED_CHARGE')),
    scheduled_charge_id uuid UNIQUE,
    status varchar(20) NOT NULL CHECK (status IN ('ACTIVE', 'VOIDED')),
    voided_at timestamptz,
    voided_by uuid,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    version bigint NOT NULL DEFAULT 0,
    UNIQUE (space_id, created_by, creation_key),
    FOREIGN KEY (space_id, created_by) REFERENCES space_members(space_id, user_id),
    FOREIGN KEY (category_id, space_id) REFERENCES categories(id, space_id),
    FOREIGN KEY (payment_method_id, space_id) REFERENCES payment_methods(id, space_id),
    FOREIGN KEY (scheduled_charge_id, space_id) REFERENCES scheduled_charges(id, space_id),
    FOREIGN KEY (space_id, voided_by) REFERENCES space_members(space_id, user_id),
    CHECK ((source = 'MANUAL' AND scheduled_charge_id IS NULL AND category_id IS NOT NULL
                AND creation_key IS NOT NULL AND creation_fingerprint IS NOT NULL
                AND name IS NOT NULL AND length(trim(name)) > 0)
        OR (source = 'SCHEDULED_CHARGE' AND scheduled_charge_id IS NOT NULL
                AND type = 'EXPENSE' AND visibility = 'SHARED')),
    CHECK ((status = 'ACTIVE' AND voided_at IS NULL AND voided_by IS NULL)
        OR (status = 'VOIDED' AND voided_at IS NOT NULL AND voided_by IS NOT NULL))
);

CREATE INDEX private_transactions_by_month ON transactions(space_id, created_by, occurred_on DESC, id)
    WHERE visibility = 'PRIVATE' AND status = 'ACTIVE';
