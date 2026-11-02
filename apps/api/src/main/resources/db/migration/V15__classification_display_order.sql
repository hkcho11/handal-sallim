ALTER TABLE categories ADD COLUMN sort_order bigint NOT NULL DEFAULT 0;
ALTER TABLE expense_subcategories ADD COLUMN sort_order bigint NOT NULL DEFAULT 0;
ALTER TABLE spaces ADD COLUMN classification_initialized boolean NOT NULL DEFAULT false;
WITH ranked AS (
    SELECT c.id, row_number() OVER (PARTITION BY c.space_id ORDER BY c.created_at, c.name, c.id) - 1 AS position FROM categories c JOIN spaces s ON s.id=c.space_id WHERE s.status='ACTIVE'
) UPDATE categories c SET sort_order=r.position FROM ranked r WHERE c.id=r.id;
WITH ranked AS (
    SELECT c.id, row_number() OVER (PARTITION BY c.space_id,c.category_id ORDER BY c.created_at,c.name,c.id) - 1 AS position FROM expense_subcategories c JOIN spaces s ON s.id=c.space_id WHERE s.status='ACTIVE'
) UPDATE expense_subcategories c SET sort_order=r.position FROM ranked r WHERE c.id=r.id;

-- Reclassify records in the same active space, preserving IDs, amounts and dates.
ALTER TABLE recurring_expense_revisions DROP CONSTRAINT revision_subcategory_space_fk;
ALTER TABLE recurring_expense_revisions ADD CONSTRAINT revision_subcategory_space_fk
    FOREIGN KEY (subcategory_id,category_id,space_id) REFERENCES expense_subcategories(id,category_id,space_id) ON UPDATE CASCADE;
ALTER TABLE scheduled_charges DROP CONSTRAINT charge_subcategory_space_fk;
ALTER TABLE scheduled_charges ADD CONSTRAINT charge_subcategory_space_fk
    FOREIGN KEY (subcategory_id,category_id,space_id) REFERENCES expense_subcategories(id,category_id,space_id) ON UPDATE CASCADE;
ALTER TABLE transactions DROP CONSTRAINT transaction_subcategory_space_fk;
ALTER TABLE transactions ADD CONSTRAINT transaction_subcategory_space_fk
    FOREIGN KEY (subcategory_id,category_id,space_id) REFERENCES expense_subcategories(id,category_id,space_id) ON UPDATE CASCADE;
