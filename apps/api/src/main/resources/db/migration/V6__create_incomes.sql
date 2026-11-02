CREATE TABLE incomes (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES spaces(id),
    created_by uuid NOT NULL,
    creation_key uuid NOT NULL,
    creation_fingerprint varchar(64) NOT NULL,
    name varchar(120) NOT NULL CHECK (length(trim(name)) > 0),
    amount bigint NOT NULL CHECK (amount BETWEEN 1 AND 9007199254740991),
    income_month date NOT NULL CHECK (extract(day FROM income_month) = 1 AND income_month BETWEEN DATE '0001-01-01' AND DATE '9999-12-01'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
    deleted_at timestamptz,
    deleted_by uuid,
    UNIQUE (space_id, created_by, creation_key),
    FOREIGN KEY (space_id, created_by) REFERENCES space_members(space_id, user_id),
    FOREIGN KEY (space_id, deleted_by) REFERENCES space_members(space_id, user_id),
    CHECK ((deleted_at IS NULL AND deleted_by IS NULL) OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL))
);
CREATE INDEX incomes_by_month ON incomes(space_id, income_month, created_at DESC, id) WHERE deleted_at IS NULL;
