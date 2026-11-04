ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_type_check;
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_type_check
    CHECK (type IN ('CARD', 'CREDIT_CARD', 'DEBIT_CARD', 'SIMPLE_PAY', 'ACCOUNT', 'CASH'));
