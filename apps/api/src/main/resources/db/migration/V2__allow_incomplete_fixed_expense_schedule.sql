ALTER TABLE recurring_expense_revisions
    ALTER COLUMN effective_from DROP NOT NULL,
    ALTER COLUMN interval_months DROP NOT NULL,
    ALTER COLUMN anchor_due_date DROP NOT NULL;
