ALTER TABLE recurring_expense_revisions
    ADD COLUMN recurring_day_of_month smallint
        CHECK (recurring_day_of_month BETWEEN 1 AND 31);

UPDATE recurring_expense_revisions
SET recurring_day_of_month = EXTRACT(DAY FROM anchor_due_date)::smallint
WHERE interval_months IS NOT NULL AND anchor_due_date IS NOT NULL;
