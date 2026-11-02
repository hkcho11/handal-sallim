-- Local admin cleanup: retain the three IDs already referenced by expenses.
-- Known duplicate IDs are listed explicitly so unrelated payment methods stay intact.
-- Run with psql -v ON_ERROR_STOP=1. Safe to run again.
BEGIN;
LOCK TABLE payment_methods, recurring_expense_revisions, scheduled_charges, transactions
    IN SHARE ROW EXCLUSIVE MODE;

DELETE FROM payment_methods unused
USING (VALUES
    ('70f4cc0a-d560-48e2-c867-38fb1f4fee7e'::uuid, 'ad49d8d2-416f-b81c-0bc8-352947508cb7'::uuid),
    ('c44109df-5ab3-673d-b0f8-86b62706ec21'::uuid, 'f8fe99ce-bea1-d468-86c6-2092e704c41c'::uuid),
    ('56e0e98b-f076-4a3a-9f24-41d189c3d13f'::uuid, '11fc48a8-cba4-abb3-982d-d8285b8d12ae'::uuid)
) AS pair(unused_id, used_id), payment_methods used
WHERE unused.id = pair.unused_id AND used.id = pair.used_id
  AND unused.space_id = '00000000-0000-0000-0000-000000000002'
  AND used.space_id = unused.space_id AND used.type = unused.type
  AND regexp_replace(used.name, '^\[샘플\] *', '') = unused.name
  AND (EXISTS (SELECT 1 FROM recurring_expense_revisions WHERE default_payment_method_id = used.id)
    OR EXISTS (SELECT 1 FROM scheduled_charges WHERE planned_payment_method_id = used.id OR actual_payment_method_id = used.id)
    OR EXISTS (SELECT 1 FROM transactions WHERE payment_method_id = used.id))
  AND NOT EXISTS (SELECT 1 FROM recurring_expense_revisions WHERE default_payment_method_id = unused.id)
  AND NOT EXISTS (SELECT 1 FROM scheduled_charges WHERE planned_payment_method_id = unused.id OR actual_payment_method_id = unused.id)
  AND NOT EXISTS (SELECT 1 FROM transactions WHERE payment_method_id = unused.id);

UPDATE payment_methods
SET name = regexp_replace(name, '^\[샘플\] *', ''), updated_at = now(), version = version + 1
WHERE space_id = '00000000-0000-0000-0000-000000000002'
  AND id IN ('ad49d8d2-416f-b81c-0bc8-352947508cb7',
             'f8fe99ce-bea1-d468-86c6-2092e704c41c',
             '11fc48a8-cba4-abb3-982d-d8285b8d12ae')
  AND name LIKE '[샘플] %';
COMMIT;
