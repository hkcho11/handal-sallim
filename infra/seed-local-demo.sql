-- Local admin development database only. Explicitly run; never applied by Flyway/startup.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('handalsallim-local-demo-v1', 0));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM space_members m JOIN users u ON u.id=m.user_id
    WHERE m.space_id='00000000-0000-0000-0000-000000000002' AND m.user_id='00000000-0000-0000-0000-000000000001'
      AND m.status='ACTIVE' AND u.display_name='admin') THEN
    RAISE EXCEPTION 'Local admin development space is required';
  END IF;
END $$;

INSERT INTO categories (id,space_id,name,applies_to,status,created_at,updated_at)
SELECT md5('handalsallim-demo-category-'||name)::uuid,'00000000-0000-0000-0000-000000000002',name,'EXPENSE','ACTIVE',now(),now()
FROM (VALUES ('주거'),('공과금'),('식비'),('교통'),('구독'),('기타'),('보험')) AS names(name)
ON CONFLICT DO NOTHING;

INSERT INTO payment_methods (id,space_id,holder_user_id,name,type,status,created_at,updated_at)
SELECT md5('handalsallim-demo-method-'||name)::uuid,'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',name,type,'ACTIVE',now(),now()
FROM (VALUES ('생활비 계좌','ACCOUNT'),('생활비 카드','CARD')) AS methods(name,type)
WHERE NOT EXISTS (SELECT 1 FROM payment_methods p WHERE p.space_id='00000000-0000-0000-0000-000000000002' AND p.name=methods.name AND p.status='ACTIVE')
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE demo_fixed ON COMMIT DROP AS
SELECT md5('handalsallim-demo-fixed-'||name)::uuid AS id,
  md5('handalsallim-demo-revision-'||name)::uuid AS revision_id,
  md5('handalsallim-demo-charge-'||name)::uuid AS charge_id,
  name,day,expected::bigint,actual::bigint,category,method,
  (date_trunc('month',now() AT TIME ZONE 'Asia/Seoul')::date + day-1) AS due_date
FROM (VALUES
  ('전기요금',10,48000,NULL,'공과금','생활비 계좌'),
  ('월세',15,650000,NULL,'주거','생활비 계좌'),
  ('인터넷',18,35000,NULL,'공과금','생활비 카드'),
  ('보험료',25,85000,NULL,'보험',NULL),
  ('영상 구독',5,17000,17000,'구독','생활비 카드'),
  ('관리비',7,120000,118000,'주거','생활비 계좌')
) AS rows(name,day,expected,actual,category,method);

INSERT INTO recurring_expenses (id,space_id,created_by,creation_key,status,created_at,updated_at)
SELECT id,'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',id,'ACTIVE',now(),now() FROM demo_fixed
ON CONFLICT DO NOTHING;

INSERT INTO recurring_expense_revisions (id,space_id,recurring_expense_id,effective_from,name,category_id,interval_months,anchor_due_date,recurring_day_of_month,default_expected_amount,assignee_user_id,default_payment_method_id,created_by,created_at)
SELECT d.revision_id,'00000000-0000-0000-0000-000000000002',d.id,d.due_date,d.name,c.id,1,d.due_date,d.day,d.expected,
  CASE WHEN d.method IS NOT NULL THEN '00000000-0000-0000-0000-000000000001'::uuid END,p.id,'00000000-0000-0000-0000-000000000001',now()
FROM demo_fixed d JOIN categories c ON c.space_id='00000000-0000-0000-0000-000000000002' AND c.name=d.category AND c.status='ACTIVE'
LEFT JOIN LATERAL (SELECT id FROM payment_methods WHERE space_id=c.space_id AND name=d.method AND status='ACTIVE' ORDER BY id LIMIT 1) p ON true
ON CONFLICT DO NOTHING;

INSERT INTO scheduled_charges (id,space_id,recurring_expense_id,recurring_expense_revision_id,due_date,expense_name,category_id,expected_amount,assignee_user_id,planned_payment_method_id,status,actual_amount,actual_paid_on,actual_payment_method_id,completed_by,completed_at,created_at,updated_at)
SELECT d.charge_id,r.space_id,d.id,r.id,d.due_date,d.name,r.category_id,d.expected,r.assignee_user_id,r.default_payment_method_id,
  CASE WHEN d.actual IS NULL THEN 'PENDING' ELSE 'COMPLETED' END,d.actual,
  CASE WHEN d.actual IS NOT NULL THEN d.due_date END,
  CASE WHEN d.actual IS NOT NULL THEN r.default_payment_method_id END,
  CASE WHEN d.actual IS NOT NULL THEN r.created_by END,
  CASE WHEN d.actual IS NOT NULL THEN now() END,now(),now()
FROM demo_fixed d JOIN recurring_expense_revisions r ON r.id=d.revision_id
ON CONFLICT DO NOTHING;

INSERT INTO transactions (id,space_id,created_by,name,type,amount,occurred_on,category_id,payment_method_id,visibility,source,scheduled_charge_id,status,created_at,updated_at)
SELECT md5('handalsallim-demo-completed-'||d.name)::uuid,sc.space_id,sc.completed_by,sc.expense_name,'EXPENSE',sc.actual_amount,sc.actual_paid_on,sc.category_id,sc.actual_payment_method_id,'SHARED','SCHEDULED_CHARGE',sc.id,'ACTIVE',now(),now()
FROM demo_fixed d JOIN scheduled_charges sc ON sc.id=d.charge_id WHERE sc.status='COMPLETED'
ON CONFLICT DO NOTHING;

INSERT INTO transactions (id,space_id,created_by,creation_key,creation_fingerprint,name,type,amount,occurred_on,category_id,payment_method_id,visibility,source,status,created_at,updated_at)
SELECT md5('handalsallim-demo-manual-'||visibility||data.name)::uuid,c.space_id,'00000000-0000-0000-0000-000000000001',
  md5('handalsallim-demo-manual-'||visibility||data.name)::uuid,repeat(md5('handalsallim-demo-'||data.name),2),data.name,'EXPENSE',amount,
  date_trunc('month',now() AT TIME ZONE 'Asia/Seoul')::date + day-1,c.id,p.id,visibility,'MANUAL','ACTIVE',now(),now()
FROM (VALUES
  ('장보기',150000,8,'식비','SHARED'),('교통비',36000,9,'교통','SHARED'),
  ('가스요금',34000,6,'공과금','SHARED'),('생활용품',64000,10,'기타','SHARED'),
  ('식사',48000,12,'식비','PRIVATE'),('대중교통',36000,11,'교통','PRIVATE'),
  ('기타 지출',42000,13,'기타','PRIVATE'),('커피',6500,10,'식비','PRIVATE'),('도서',18000,9,'기타','PRIVATE')
) AS data(name,amount,day,category,visibility)
JOIN categories c ON c.space_id='00000000-0000-0000-0000-000000000002' AND c.name=data.category AND c.status='ACTIVE'
JOIN LATERAL (SELECT id FROM payment_methods WHERE space_id=c.space_id AND name='생활비 카드' AND status='ACTIVE' ORDER BY id LIMIT 1) p ON true
ON CONFLICT DO NOTHING;
COMMIT;
