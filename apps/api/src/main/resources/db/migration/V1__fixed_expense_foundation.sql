CREATE TABLE users (
    id uuid PRIMARY KEY,
    display_name varchar(100) NOT NULL,
    status varchar(20) NOT NULL CHECK (status IN ('ACTIVE', 'DEACTIVATED')),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE TABLE spaces (
    id uuid PRIMARY KEY,
    management_mode varchar(20) NOT NULL CHECK (management_mode IN ('SOLO', 'SHARED_PENDING', 'SHARED')),
    name varchar(100),
    time_zone varchar(50) NOT NULL DEFAULT 'Asia/Seoul',
    status varchar(20) NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    version bigint NOT NULL DEFAULT 0
);

CREATE TABLE space_members (
    space_id uuid NOT NULL REFERENCES spaces(id),
    user_id uuid NOT NULL REFERENCES users(id),
    role varchar(20) NOT NULL CHECK (role IN ('OWNER', 'MEMBER')),
    status varchar(20) NOT NULL CHECK (status IN ('ACTIVE', 'LEFT', 'REMOVED')),
    joined_at timestamptz NOT NULL,
    ended_at timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (space_id, user_id)
);
CREATE UNIQUE INDEX one_active_space_per_user ON space_members(user_id) WHERE status = 'ACTIVE';

CREATE TABLE categories (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES spaces(id),
    name varchar(80) NOT NULL,
    applies_to varchar(20) NOT NULL CHECK (applies_to IN ('EXPENSE', 'INCOME', 'BOTH')),
    status varchar(20) NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    version bigint NOT NULL DEFAULT 0,
    UNIQUE (id, space_id)
);
CREATE UNIQUE INDEX active_category_name_per_space ON categories(space_id, name) WHERE status = 'ACTIVE';

CREATE TABLE payment_methods (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES spaces(id),
    holder_user_id uuid,
    name varchar(100) NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('CARD', 'ACCOUNT', 'CASH')),
    color varchar(20),
    status varchar(20) NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    archived_at timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    version bigint NOT NULL DEFAULT 0,
    UNIQUE (id, space_id),
    FOREIGN KEY (space_id, holder_user_id) REFERENCES space_members(space_id, user_id)
);

CREATE TABLE recurring_expenses (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES spaces(id),
    created_by uuid NOT NULL,
    creation_key uuid NOT NULL,
    status varchar(20) NOT NULL CHECK (status IN ('ACTIVE', 'PAUSED', 'ENDED')),
    paused_at timestamptz,
    ended_at timestamptz,
    ended_from_due_date date,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    version bigint NOT NULL DEFAULT 0,
    UNIQUE (id, space_id),
    UNIQUE (space_id, creation_key),
    FOREIGN KEY (space_id, created_by) REFERENCES space_members(space_id, user_id)
);
CREATE INDEX recurring_expenses_by_space ON recurring_expenses(space_id, created_at DESC);

CREATE TABLE recurring_expense_revisions (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES spaces(id),
    recurring_expense_id uuid NOT NULL,
    effective_from date NOT NULL,
    name varchar(120) NOT NULL CHECK (length(trim(name)) > 0),
    category_id uuid,
    interval_months smallint NOT NULL CHECK (interval_months IN (1, 2, 3, 12)),
    anchor_due_date date NOT NULL,
    default_expected_amount bigint NOT NULL CHECK (default_expected_amount BETWEEN 1 AND 9007199254740991),
    assignee_user_id uuid,
    default_payment_method_id uuid,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL,
    UNIQUE (recurring_expense_id, effective_from),
    UNIQUE (id, recurring_expense_id, space_id),
    FOREIGN KEY (recurring_expense_id, space_id) REFERENCES recurring_expenses(id, space_id),
    FOREIGN KEY (category_id, space_id) REFERENCES categories(id, space_id),
    FOREIGN KEY (default_payment_method_id, space_id) REFERENCES payment_methods(id, space_id),
    FOREIGN KEY (space_id, created_by) REFERENCES space_members(space_id, user_id),
    FOREIGN KEY (space_id, assignee_user_id) REFERENCES space_members(space_id, user_id)
);

CREATE TABLE scheduled_charges (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES spaces(id),
    recurring_expense_id uuid NOT NULL,
    recurring_expense_revision_id uuid NOT NULL,
    due_date date NOT NULL,
    expense_name varchar(120) NOT NULL,
    category_id uuid,
    expected_amount bigint NOT NULL CHECK (expected_amount BETWEEN 1 AND 9007199254740991),
    assignee_user_id uuid,
    planned_payment_method_id uuid,
    status varchar(20) NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    actual_amount bigint CHECK (actual_amount > 0),
    actual_paid_on date,
    actual_payment_method_id uuid,
    completed_by uuid,
    completed_at timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    version bigint NOT NULL DEFAULT 0,
    UNIQUE (id, space_id),
    UNIQUE (recurring_expense_id, due_date),
    FOREIGN KEY (recurring_expense_id, space_id) REFERENCES recurring_expenses(id, space_id),
    FOREIGN KEY (recurring_expense_revision_id, recurring_expense_id, space_id)
        REFERENCES recurring_expense_revisions(id, recurring_expense_id, space_id),
    FOREIGN KEY (category_id, space_id) REFERENCES categories(id, space_id),
    FOREIGN KEY (planned_payment_method_id, space_id) REFERENCES payment_methods(id, space_id),
    FOREIGN KEY (actual_payment_method_id, space_id) REFERENCES payment_methods(id, space_id),
    FOREIGN KEY (space_id, assignee_user_id) REFERENCES space_members(space_id, user_id),
    FOREIGN KEY (space_id, completed_by) REFERENCES space_members(space_id, user_id),
    CHECK ((status = 'COMPLETED' AND actual_amount IS NOT NULL AND actual_paid_on IS NOT NULL
            AND actual_payment_method_id IS NOT NULL AND completed_by IS NOT NULL AND completed_at IS NOT NULL)
        OR (status <> 'COMPLETED' AND actual_amount IS NULL AND actual_paid_on IS NULL
            AND actual_payment_method_id IS NULL AND completed_by IS NULL AND completed_at IS NULL))
);
CREATE INDEX scheduled_charges_by_space_and_date ON scheduled_charges(space_id, due_date, status);
