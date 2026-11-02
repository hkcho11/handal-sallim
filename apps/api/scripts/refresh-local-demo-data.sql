-- Explicitly requested local walkthrough data for 2026-05 through 2026-10.
-- Back up the local database first; run with psql -v ON_ERROR_STOP=1.
-- Existing expense/charge/transaction IDs and amounts are retained.
-- Stable IDs and natural-key checks make repeated execution a no-op for inserts.
BEGIN;
LOCK TABLE users, spaces, categories, expense_subcategories, payment_methods,
    recurring_expenses, recurring_expense_revisions, scheduled_charges,
    transactions, incomes, savings IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE walkthrough_context ON COMMIT DROP AS
SELECT id AS space_id, created_by AS user_id FROM spaces
WHERE id = '00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
    IF (SELECT count(*) FROM walkthrough_context) <> 1 THEN
        RAISE EXCEPTION 'Local admin space is required';
    END IF;
END $$;

-- These exact disposable entries were inspected before this script was written.
DELETE FROM incomes WHERE space_id = (SELECT space_id FROM walkthrough_context)
AND ((id = '50e58cd9-c9f6-48e8-9832-06e4e70a3626' AND name = 'ee')
  OR (id = '0109a6ea-9822-426f-a6ea-8cdd2571c08d' AND name = 'gg')
  OR (id IN ('abeae3bf-e857-4c40-a0ac-f7bcab61a037', 'd0bc7595-6c8a-4e4a-912f-a3b5603c5bbb')
      AND name LIKE '[동작확인]%'));
DELETE FROM savings WHERE space_id = (SELECT space_id FROM walkthrough_context)
AND id IN ('82b6190e-8016-49b0-91f3-b1c5a1211091', '0e19a747-5436-463b-81e2-d4ee4b62accc')
AND name LIKE '[동작확인]%';

-- Remove the label from every user-visible text field, including historical records.
DO $$
DECLARE field record; scope text; extra text;
BEGIN
    FOR field IN SELECT * FROM (VALUES
        ('users','display_name'), ('spaces','name'), ('categories','name'),
        ('expense_subcategories','name'), ('payment_methods','name'),
        ('recurring_expense_revisions','name'), ('recurring_expense_revisions','memo'),
        ('scheduled_charges','expense_name'), ('scheduled_charges','memo'),
        ('transactions','name'), ('transactions','memo'), ('incomes','name'), ('savings','name')
    ) AS fields(table_name,column_name) LOOP
        scope := CASE WHEN field.table_name = 'users'
            THEN 'id = (SELECT user_id FROM walkthrough_context)'
            WHEN field.table_name = 'spaces' THEN 'id = (SELECT space_id FROM walkthrough_context)'
            ELSE 'space_id = (SELECT space_id FROM walkthrough_context)' END;
        extra := '';
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
            AND table_name = field.table_name AND column_name = 'version') THEN
            extra := extra || ', version = version + 1';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
            AND table_name = field.table_name AND column_name = 'updated_at') THEN
            extra := extra || ', updated_at = now()';
        END IF;
        EXECUTE format('UPDATE %I SET %I = btrim(replace(%I, %L, %L)) %s WHERE %s AND position(%L IN %I) > 0',
            field.table_name, field.column_name, field.column_name, '[샘플]', '', extra,
            scope, '[샘플]', field.column_name);
    END LOOP;
END $$;

CREATE TEMP TABLE walkthrough_expenses ON COMMIT DROP AS
SELECT md5('walkthrough-expense:' || seed.name)::uuid AS id,
    md5('walkthrough-revision:' || seed.name)::uuid AS revision_id,
    ctx.*, seed.*, sub.id AS subcategory_id, sub.category_id,
    pm.id AS payment_method_id, make_date(2026,5,seed.day) AS anchor
FROM (VALUES
    ('음악 스트리밍', '음악', 10900::bigint, 9, '생활비 카드'),
    ('클라우드 저장공간', '소프트웨어', 8900::bigint, 18, '생활비 카드'),
    ('쇼핑 멤버십', '쇼핑 멤버십', 4990::bigint, 23, '생활비 카드'),
    ('아파트 주차비', '주차비', 60000::bigint, 3, '생활비 계좌'),
    ('자동차 보험', '자동차보험', 78000::bigint, 27, '생활비 계좌'),
    ('공기청정기 렌탈', '공기청정기', 19900::bigint, 20, '생활비 카드')
) AS seed(name, subcategory, amount, day, payment)
CROSS JOIN walkthrough_context ctx
JOIN expense_subcategories sub ON sub.space_id = ctx.space_id AND sub.name = seed.subcategory AND sub.status = 'ACTIVE'
JOIN payment_methods pm ON pm.space_id = ctx.space_id AND pm.name = seed.payment AND pm.status = 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM recurring_expense_revisions r
    WHERE r.space_id = ctx.space_id AND (r.name = seed.name OR r.memo = seed.name));

INSERT INTO recurring_expenses (id,space_id,created_by,creation_key,status,created_at,updated_at)
SELECT id,space_id,user_id,id,'ACTIVE',anchor,now() FROM walkthrough_expenses
ON CONFLICT DO NOTHING;
INSERT INTO recurring_expense_revisions (id,space_id,recurring_expense_id,effective_from,
    name,category_id,interval_months,anchor_due_date,default_expected_amount,
    assignee_user_id,default_payment_method_id,created_by,created_at,recurring_day_of_month,subcategory_id,memo)
SELECT revision_id,space_id,id,anchor,name,category_id,1,anchor,amount,
    user_id,payment_method_id,user_id,anchor,day,subcategory_id,name
FROM walkthrough_expenses ON CONFLICT DO NOTHING;

CREATE TEMP TABLE walkthrough_charges ON COMMIT DROP AS
SELECT md5('walkthrough-charge:' || e.id || ':' || m.month)::uuid AS charge_id,
    e.*, make_date(2026,m.month,e.day) AS due_date,
    make_date(2026,m.month,e.day) <= DATE '2026-10-15' AS paid
FROM walkthrough_expenses e CROSS JOIN generate_series(5,10) m(month);
INSERT INTO scheduled_charges (id,space_id,recurring_expense_id,recurring_expense_revision_id,
    due_date,expense_name,category_id,expected_amount,assignee_user_id,planned_payment_method_id,
    status,actual_amount,actual_paid_on,actual_payment_method_id,completed_by,completed_at,
    created_at,updated_at,subcategory_id,memo)
SELECT charge_id,space_id,id,revision_id,due_date,name,category_id,amount,user_id,payment_method_id,
    CASE WHEN paid THEN 'COMPLETED' ELSE 'PENDING' END,
    CASE WHEN paid THEN amount END, CASE WHEN paid THEN due_date END,
    CASE WHEN paid THEN payment_method_id END, CASE WHEN paid THEN user_id END,
    CASE WHEN paid THEN due_date::timestamp AT TIME ZONE 'Asia/Seoul' END,
    anchor,now(),subcategory_id,name
FROM walkthrough_charges ON CONFLICT DO NOTHING;
INSERT INTO transactions (id,space_id,created_by,type,amount,occurred_on,category_id,
    payment_method_id,memo,visibility,source,scheduled_charge_id,status,created_at,updated_at,subcategory_id)
SELECT md5('walkthrough-transaction:' || charge_id)::uuid,space_id,user_id,'EXPENSE',amount,
    due_date,category_id,payment_method_id,name,'SHARED','SCHEDULED_CHARGE',charge_id,'ACTIVE',
    due_date::timestamp AT TIME ZONE 'Asia/Seoul',now(),subcategory_id
FROM walkthrough_charges WHERE paid ON CONFLICT DO NOTHING;

WITH entries AS (
    SELECT ctx.*, seed.name,
        seed.amount + CASE WHEN seed.name = '외주 디자인 수입' THEN (m.month - 5) * 30000 ELSE 0 END AS amount,
        make_date(2026,m.month,1) AS month,
        md5('walkthrough-income:' || seed.name || ':' || m.month)::uuid AS id
    FROM (VALUES ('급여',3200000::bigint),('외주 디자인 수입',300000::bigint),('예금 이자',18500::bigint)) seed(name,amount)
    CROSS JOIN generate_series(5,10) m(month) CROSS JOIN walkthrough_context ctx
)
INSERT INTO incomes (id,space_id,created_by,creation_key,creation_fingerprint,name,amount,income_month,owner_user_id)
SELECT id,space_id,user_id,id,
    encode(sha256(convert_to(length(name) || ':' || name || ':' || amount || ':' || to_char(month,'YYYY-MM') || ':' || user_id,'UTF8')),'hex'),
    name,amount,month,user_id FROM entries e
WHERE NOT EXISTS (SELECT 1 FROM incomes i WHERE i.space_id=e.space_id AND i.name=e.name
    AND i.income_month=e.month AND i.deleted_at IS NULL)
ON CONFLICT DO NOTHING;

WITH entries AS (
    SELECT ctx.*, seed.*, md5('walkthrough-saving:' || seed.name)::uuid AS id
    FROM (VALUES
        ('비상금 정기예금','DEPOSIT',5000000::bigint,5000000::bigint),
        ('주택 마련 적금','INSTALLMENT',500000::bigint,3000000::bigint),
        ('여행 적금','INSTALLMENT',200000::bigint,1200000::bigint),
        ('차량 교체 적금','INSTALLMENT',150000::bigint,900000::bigint)
    ) seed(name,type,deposit_amount,current_amount) CROSS JOIN walkthrough_context ctx
)
INSERT INTO savings (id,space_id,created_by,creation_key,creation_fingerprint,name,type,deposit_amount,current_amount,owner_user_id)
SELECT id,space_id,user_id,id,
    encode(sha256(convert_to(length(name) || ':' || name || ':' || type || ':' || deposit_amount || ':' || current_amount || ':' || user_id,'UTF8')),'hex'),
    name,type,deposit_amount,current_amount,user_id FROM entries e
WHERE NOT EXISTS (SELECT 1 FROM savings s WHERE s.space_id=e.space_id AND s.name=e.name AND s.deleted_at IS NULL)
ON CONFLICT DO NOTHING;
COMMIT;
