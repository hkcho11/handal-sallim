CREATE TABLE expense_subcategories (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES spaces(id),
    category_id uuid NOT NULL,
    name varchar(80) NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
    status varchar(20) NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at timestamptz NOT NULL,
    UNIQUE (id, category_id, space_id),
    FOREIGN KEY (category_id, space_id) REFERENCES categories(id, space_id)
);
CREATE UNIQUE INDEX active_subcategory_name_per_category
    ON expense_subcategories(space_id, category_id, name) WHERE status = 'ACTIVE';

-- Existing names and classification remain intact until a user-approved data reset.
ALTER TABLE recurring_expense_revisions ADD COLUMN subcategory_id uuid;
ALTER TABLE recurring_expense_revisions ADD COLUMN memo varchar(120);
ALTER TABLE recurring_expense_revisions ADD CONSTRAINT revision_subcategory_space_fk
    FOREIGN KEY (subcategory_id, category_id, space_id)
    REFERENCES expense_subcategories(id, category_id, space_id);
ALTER TABLE recurring_expense_revisions ADD CONSTRAINT revision_subcategory_requires_category
    CHECK (subcategory_id IS NULL OR category_id IS NOT NULL);

ALTER TABLE scheduled_charges ADD COLUMN subcategory_id uuid;
ALTER TABLE scheduled_charges ADD COLUMN memo varchar(120);
ALTER TABLE scheduled_charges ADD CONSTRAINT charge_subcategory_space_fk
    FOREIGN KEY (subcategory_id, category_id, space_id)
    REFERENCES expense_subcategories(id, category_id, space_id);
ALTER TABLE scheduled_charges ADD CONSTRAINT charge_subcategory_requires_category
    CHECK (subcategory_id IS NULL OR category_id IS NOT NULL);

ALTER TABLE transactions ADD COLUMN subcategory_id uuid;
ALTER TABLE transactions ADD CONSTRAINT transaction_subcategory_space_fk
    FOREIGN KEY (subcategory_id, category_id, space_id)
    REFERENCES expense_subcategories(id, category_id, space_id);
ALTER TABLE transactions ADD CONSTRAINT transaction_subcategory_requires_category
    CHECK (subcategory_id IS NULL OR category_id IS NOT NULL);
