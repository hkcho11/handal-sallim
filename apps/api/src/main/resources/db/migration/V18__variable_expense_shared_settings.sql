ALTER TABLE recurring_expense_revisions DROP CONSTRAINT revision_variable_inputs;
ALTER TABLE recurring_expense_revisions ADD CONSTRAINT revision_variable_inputs CHECK (
    billing_mode <> 'VARIABLE' OR
    (billing_month IS NOT NULL AND default_expected_amount IS NULL AND anchor_due_date IS NULL));
