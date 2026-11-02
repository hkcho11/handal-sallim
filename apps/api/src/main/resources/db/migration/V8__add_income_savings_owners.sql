ALTER TABLE incomes ADD COLUMN owner_user_id uuid;
UPDATE incomes SET owner_user_id = created_by;
ALTER TABLE incomes ALTER COLUMN owner_user_id SET NOT NULL;
ALTER TABLE incomes ADD CONSTRAINT income_owner_in_space FOREIGN KEY (space_id, owner_user_id) REFERENCES space_members(space_id, user_id);
CREATE INDEX incomes_by_owner ON incomes(space_id, owner_user_id) WHERE deleted_at IS NULL;

ALTER TABLE savings ADD COLUMN owner_user_id uuid;
UPDATE savings SET owner_user_id = created_by;
ALTER TABLE savings ALTER COLUMN owner_user_id SET NOT NULL;
ALTER TABLE savings ADD CONSTRAINT savings_owner_in_space FOREIGN KEY (space_id, owner_user_id) REFERENCES space_members(space_id, user_id);
CREATE INDEX savings_by_owner ON savings(space_id, owner_user_id) WHERE deleted_at IS NULL;
