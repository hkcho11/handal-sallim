ALTER TABLE recurring_expense_revisions
    ADD COLUMN billing_mode varchar(20) NOT NULL DEFAULT 'LEGACY'
        CHECK (billing_mode IN ('LEGACY', 'FIXED', 'VARIABLE')),
    ADD COLUMN billing_month date CHECK (billing_month = date_trunc('month', billing_month)::date),
    ADD COLUMN auto_from_date date;
ALTER TABLE recurring_expense_revisions ALTER COLUMN default_expected_amount DROP NOT NULL;
ALTER TABLE recurring_expense_revisions ADD CONSTRAINT revision_amount_by_mode CHECK (
    billing_mode = 'VARIABLE' OR default_expected_amount IS NOT NULL);
ALTER TABLE recurring_expense_revisions ADD CONSTRAINT revision_variable_inputs CHECK (
    billing_mode <> 'VARIABLE' OR
    (billing_month IS NOT NULL AND default_expected_amount IS NULL AND anchor_due_date IS NULL
     AND interval_months IS NULL AND recurring_day_of_month IS NULL));
ALTER TABLE recurring_expense_revisions ADD CONSTRAINT revision_fixed_inputs CHECK (
    billing_mode <> 'FIXED' OR
    (default_expected_amount IS NOT NULL AND anchor_due_date IS NOT NULL
     AND interval_months IS NOT NULL AND recurring_day_of_month IS NOT NULL));
ALTER TABLE scheduled_charges ADD COLUMN billing_month date
    CHECK (billing_month = date_trunc('month', billing_month)::date);
CREATE UNIQUE INDEX charges_by_billing_month ON scheduled_charges(recurring_expense_id, billing_month)
    WHERE billing_month IS NOT NULL AND status <> 'CANCELLED';
ALTER TABLE scheduled_charges DROP CONSTRAINT scheduled_charges_recurring_expense_id_due_date_key;
CREATE UNIQUE INDEX active_charge_by_due_date ON scheduled_charges(recurring_expense_id, due_date)
    WHERE status <> 'CANCELLED';
