-- Keep registered/legacy amounts intact; generated future cycles have no quoted amount.
ALTER TABLE scheduled_charges ALTER COLUMN expected_amount DROP NOT NULL;
