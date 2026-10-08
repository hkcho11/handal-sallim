# 한달살림 핵심 데이터 스키마

> 상태: Approved — 인증 상세 필드와 UX를 제외한 MVP 도메인·데이터 기준
>
> 기준: `SERVICE_PLAN.md` 0.4
>
> 목적: 핵심 용어, 엔티티, 관계, 필드와 데이터베이스 불변 조건을 구현 전에 합의한다.

## 1. 설계 원칙

- PostgreSQL을 기준으로 설계한다.
- 기본 키는 UUID를 사용하고 외부에 순차 식별자를 노출하지 않는다.
- 금액은 원 단위 `bigint` 양수로 저장하고 수입·지출은 유형으로 구분한다.
- 업무 날짜는 공간의 현지 날짜인 `date`, 사건 시각은 UTC 기준 `timestamptz`로 저장한다.
- 모든 공간 소유 데이터에는 권한 경계인 `space_id`를 둔다.
- 공간 소유 엔티티 사이의 참조는 `(id, space_id)` 복합 FK로 같은 공간임을 데이터베이스에서도 보장한다.
- 화면에서 전달한 사용자·공간 식별자를 권한 근거로 신뢰하지 않는다.
- 반복 설정, 예정 청구와 실제 거래를 별도 엔티티로 유지한다.
- 반복 설정의 다음 회차부터 변경은 적용 예정일을 가진 불변 revision으로 기록한다.
- 지연 여부는 저장하지 않고 현지 날짜와 예정일로 계산한다.
- 완료·취소처럼 여러 행을 바꾸는 작업은 하나의 서버 트랜잭션으로 처리한다.
- 데이터베이스 제약과 서버 검증을 함께 사용한다.

## 2. 공통 필드

업무 테이블은 특별한 이유가 없으면 다음 필드를 가진다.

| 필드 | PostgreSQL 타입 | 규칙 |
|---|---|---|
| `id` | `uuid` | PK, 서버 생성 |
| `created_at` | `timestamptz` | NOT NULL, 생성 시각 |
| `updated_at` | `timestamptz` | NOT NULL, 변경 시각 |
| `version` | `bigint` | 동시 수정 위험이 있는 가변 엔티티에만 사용. NOT NULL, 기본값 0 |

물리 삭제 대신 보관이 필요한 엔티티에는 상태와 `archived_at` 또는 `voided_at`을 사용한다. 무조건적인 `deleted_at` 추가는 피하고 엔티티별 보존 의미를 명확히 한다.

## 3. 엔티티 목록

| 엔티티 | 테이블 | 책임 |
|---|---|---|
| 사용자 | `users` | 애플리케이션 사용자 식별과 표시 정보 |
| 인증 식별자 | `auth_identities` | 외부 인증 주체와 내부 사용자의 연결. 인증 방식 확정 후 사용 |
| 관리 공간 | `spaces` | 혼자/함께 관리 데이터의 최상위 권한 경계 |
| 공간 멤버십 | `space_members` | 사용자와 공간의 활성 관계 및 역할 |
| 초대 | `invitations` | 만료형·일회용 참여 자격 증명 |
| 카테고리 | `categories` | 공간별 분류 기준. 기본 목록도 공간별 행으로 생성 |
| 결제수단 | `payment_methods` | 카드·계좌·현금의 안전한 표시 정보 |
| 반복 고정비 | `recurring_expenses` | 반복 항목의 안정적인 식별자와 생명주기 |
| 반복 설정 revision | `recurring_expense_revisions` | 적용 시작일별 반복 규칙과 기본값 |
| 예정 청구 | `scheduled_charges` | 특정 예정일에 발생한 회차 스냅샷 |
| 실제 거래 | `transactions` | 실제 수입·지출과 공개 범위 |

## 4. 필드 정의

### 4.1 `users`

인증 수단과 분리된 애플리케이션 사용자다. 공간과 거래는 외부 인증 주체가 아니라 이 ID를 참조한다.

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `display_name` | `varchar(100)` | Y | 관계나 성별을 전제하지 않는 표시명 |
| `status` | `varchar(20)` | Y | `ACTIVE`, `DEACTIVATED` |
| `created_at` | `timestamptz` | Y | 생성 시각 |
| `updated_at` | `timestamptz` | Y | 변경 시각 |

이메일과 전화번호는 인증 방식이 확정되기 전까지 핵심 사용자 테이블에 추가하지 않는다. 인증 제공자 식별자를 이 테이블에 직접 추가하지 않는다.

### 4.2 `auth_identities`

인증 설계가 확정될 때 도입하는 경계 테이블이다. 한 사용자가 여러 로그인 수단을 연결해도 도메인 사용자 ID는 유지한다.

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `user_id` | `uuid` | Y | FK → `users.id` |
| `issuer` | `varchar(255)` | Y | 인증 토큰 발급자 |
| `subject` | `varchar(255)` | Y | 발급자 안에서 유일한 사용자 식별자 |
| `status` | `varchar(20)` | Y | `ACTIVE`, `UNLINKED` |
| `linked_at` | `timestamptz` | Y | 연결 시각 |
| `unlinked_at` | `timestamptz` | N | 연결 해제 시각 |
| `created_at` | `timestamptz` | Y | 생성 시각 |
| `updated_at` | `timestamptz` | Y | 변경 시각 |

제약/인덱스:

- UNIQUE: `(issuer, subject)`
- INDEX: `(user_id, status)`
- 이메일, 전화번호와 provider token을 `subject` 대신 저장하지 않는다.

### 4.3 `spaces`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `management_mode` | `varchar(20)` | Y | `SOLO`, `SHARED_PENDING`, `SHARED` |
| `name` | `varchar(100)` | N | 함께 관리 화면의 선택적 표시명 |
| `time_zone` | `varchar(50)` | Y | 제안 기본값 `Asia/Seoul` |
| `status` | `varchar(20)` | Y | `ACTIVE`, `ARCHIVED` |
| `created_by` | `uuid` | Y | FK → `users.id` |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

규칙:

- `SHARED` 공간에는 활성 멤버가 정확히 두 명이어야 한다.
- 최대 두 명 제약은 공간 행을 잠근 서버 트랜잭션에서 검사한다.
- 신규 사용자는 공간 없이 시작하며 `공간 추가`에서 혼자/함께 관리를 선택할 때 공간과 OWNER 멤버십을 생성한다.
- 함께 관리를 선택하면 초대 수락 전까지 `SHARED_PENDING` 상태로 생성자가 먼저 사용한다.
- 한 사용자의 활성 관리 공간은 MVP에서 하나만 허용한다.

### 4.4 `space_members`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `space_id` | `uuid` | Y | PK 일부, FK → `spaces.id` |
| `user_id` | `uuid` | Y | PK 일부, FK → `users.id` |
| `role` | `varchar(20)` | Y | `OWNER`, `MEMBER` |
| `status` | `varchar(20)` | Y | `ACTIVE`, `LEFT`, `REMOVED` |
| `joined_at` | `timestamptz` | Y | 참여 시각 |
| `ended_at` | `timestamptz` | N | 멤버십 종료 시각 |
| `created_at` | `timestamptz` | Y | 생성 시각 |
| `updated_at` | `timestamptz` | Y | 변경 시각 |

제약/인덱스:

- PK: `(space_id, user_id)`
- 부분 UNIQUE 제안: 활성 멤버십의 `user_id` — 한 사용자의 다중 공간 방지
- INDEX: `(space_id, status)` — 활성 멤버 권한 확인

### 4.5 `invitations`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | Y | FK → `spaces.id` |
| `invited_by` | `uuid` | Y | `(space_id, invited_by)` → `space_members(space_id, user_id)` |
| `token_hash` | `varchar(255)` | Y | UNIQUE, 원문 저장 금지 |
| `status` | `varchar(20)` | Y | `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED` |
| `expires_at` | `timestamptz` | Y | 만료 시각 |
| `accepted_by` | `uuid` | N | FK → `users.id` |
| `accepted_at` | `timestamptz` | N | 수락 시각 |
| `revoked_at` | `timestamptz` | N | 취소 시각 |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

초대는 발급 후 24시간 동안만 유효하다. 수락은 초대 상태 확인, 만료 검사, 멤버 수 확인, 멤버십 생성과 공간 상태 변경을 한 트랜잭션으로 처리한다. 공간당 `PENDING` 초대는 한 건만 허용하는 부분 UNIQUE 인덱스를 둔다.

### 4.6 `categories`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | Y | FK → `spaces.id`; 모든 카테고리는 한 공간에 소속 |
| `name` | `varchar(80)` | Y | 표시명 |
| `applies_to` | `varchar(20)` | Y | `EXPENSE`, `INCOME`, `BOTH` |
| `status` | `varchar(20)` | Y | `ACTIVE`, `ARCHIVED` |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

공간별 활성 카테고리 이름 중복을 막는 부분 UNIQUE 인덱스를 둔다. 시스템 기본 카테고리는 전역 행으로 공유하지 않고 공간 생성 시 seed 목록을 각 공간의 카테고리로 생성한다.

### 4.7 `payment_methods`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | Y | FK → `spaces.id` |
| `holder_user_id` | `uuid` | N | `(space_id, holder_user_id)` → 공간 멤버, 명의자/담당자 |
| `name` | `varchar(100)` | Y | 사용자가 정한 표시명 |
| `type` | `varchar(20)` | Y | `CARD`, `ACCOUNT`, `CASH` |
| `color` | `varchar(20)` | N | 허용 형식을 경계에서 검증 |
| `status` | `varchar(20)` | Y | `ACTIVE`, `ARCHIVED` |
| `archived_at` | `timestamptz` | N | 보관 시각 |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

실제 카드번호·계좌번호 전체를 저장하는 필드는 만들지 않는다. 사용 중인 결제수단은 물리 삭제하지 않고 `ARCHIVED`로 보관하며 대체 결제수단을 필수로 요구하지 않는다. 과거 완료 기록은 기존 참조를 유지하고, 연결된 반복 고정비에는 다음 미완료 회차부터 적용되는 결제수단 미지정 revision을 생성한다.

### 4.8 `recurring_expenses`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | Y | FK → `spaces.id` |
| `created_by` | `uuid` | Y | `(space_id, created_by)` → 활성 공간 멤버인지 서버에서 추가 확인 |
| `status` | `varchar(20)` | Y | `ACTIVE`, `PAUSED`, `ENDED` |
| `paused_at` | `timestamptz` | N | 일시 중지 시각 |
| `ended_at` | `timestamptz` | N | 종료 시각 |
| `ended_from_due_date` | `date` | N | 선택한 회차부터 삭제할 때 적용되는 첫 예정일 |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

이 테이블은 반복 항목의 정체성과 생명주기만 가진다. 이름, 주기, 금액과 기본 결제수단은 revision에 둔다.

### 4.9 `recurring_expense_revisions`

`recurring_expenses`의 시점별 설정이다. 생성된 revision은 직접 덮어쓰지 않고 새로운 적용 시작일의 revision을 추가한다.

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | Y | FK → `spaces.id` |
| `recurring_expense_id` | `uuid` | Y | `(recurring_expense_id, space_id)` → `recurring_expenses(id, space_id)` |
| `effective_from` | `date` | Y | 이 revision이 적용되는 첫 예정일 |
| `name` | `varchar(120)` | Y | 비용명 |
| `category_id` | `uuid` | N | `(category_id, space_id)` → `categories(id, space_id)`, 등록 후 보완 가능 |
| `interval_months` | `smallint` | Y | CHECK IN `(1, 2, 3, 12)` |
| `anchor_due_date` | `date` | Y | 반복 계산 기준 예정일 |
| `default_expected_amount` | `bigint` | Y | CHECK > 0, 원 단위 |
| `assignee_user_id` | `uuid` | N | `(space_id, assignee_user_id)` → `space_members(space_id, user_id)`, 등록 후 보완 가능 |
| `default_payment_method_id` | `uuid` | N | 등록 시 선택. 등록 후 지정하거나 결제수단 보관 후 미지정 가능 |
| `created_by` | `uuid` | Y | `(space_id, created_by)` → `space_members(space_id, user_id)` |
| `created_at` | `timestamptz` | Y | 생성 시각 |

제약/규칙:

- UNIQUE: `(recurring_expense_id, effective_from)`
- UNIQUE: `(id, recurring_expense_id, space_id)` — 예정 청구의 동일 반복 설정 revision 참조용
- 예정일 이하에서 `effective_from`이 가장 최근인 revision 하나를 적용한다.
- `이번 발생분만 변경`은 예정 청구 스냅샷만 수정한다.
- `다음 발생분부터 변경`은 새 revision을 만들고 적용일 이후의 미완료 청구만 새 revision 기준으로 다시 계산한다.
- 완료된 청구는 revision 변경으로 수정하지 않는다.
- 새 revision의 첫 회차는 `default_expected_amount`를 사용하고, 같은 revision의 후속 회차는 별도 변경이 없으면 직전 실제 결제 금액을 사용한다.
- 최초 등록은 비용명, 예상 금액, 반복 간격과 첫 예정일만 요구하며 카테고리, 담당자와 기본 결제수단이 NULL인 revision을 허용한다.
- 선택 정보를 나중에 채우면 적용 범위 선택에 따라 현재 미완료 청구 스냅샷을 수정하거나 새 revision을 만든다.
- 결제수단이 보관되면 다음 미완료 회차부터 `default_payment_method_id`가 NULL인 새 revision을 만들 수 있다.

### 4.10 `scheduled_charges`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | Y | FK → `spaces.id`, 권한/조회 경계 |
| `recurring_expense_id` | `uuid` | Y | `(recurring_expense_id, space_id)` → `recurring_expenses(id, space_id)` |
| `recurring_expense_revision_id` | `uuid` | Y | 적용된 revision; 반복 설정·공간과 함께 복합 FK로 검증 |
| `due_date` | `date` | Y | 해당 회차 예정일 |
| `expense_name` | `varchar(120)` | Y | 발생 당시 비용명 스냅샷 |
| `category_id` | `uuid` | N | 발생 당시 카테고리, 미지정 가능 |
| `expected_amount` | `bigint` | Y | CHECK > 0 |
| `assignee_user_id` | `uuid` | N | `(space_id, assignee_user_id)` → 공간 멤버, 발생 당시 담당자, 미지정 가능 |
| `planned_payment_method_id` | `uuid` | N | 발생 당시 기본 결제수단. 최초 등록 또는 보관 후 미지정 가능 |
| `status` | `varchar(20)` | Y | `PENDING`, `COMPLETED`, `CANCELLED` |
| `actual_amount` | `bigint` | N | 완료 시 CHECK > 0 |
| `actual_paid_on` | `date` | N | 완료 시 실제 결제일 |
| `actual_payment_method_id` | `uuid` | N | 완료 시 `(actual_payment_method_id, space_id)` 복합 FK |
| `completed_by` | `uuid` | N | `(space_id, completed_by)` → 공간 멤버 |
| `completed_at` | `timestamptz` | N | 완료 시각 |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

제약/인덱스:

- UNIQUE: `(recurring_expense_id, due_date)` — 같은 회차 중복 생성 방지
- INDEX: `(space_id, due_date, status)` — 월간 타임라인과 리마인드
- 완료 상태이면 실제 금액·날짜·결제수단·완료자·완료시각이 모두 존재하는 CHECK
- `PENDING`이고 `due_date`가 현지 오늘보다 이전이면 조회 결과에서 `OVERDUE`로 표현
- 결제수단 미지정 청구도 조회할 수 있으며 완료 시에는 실제 결제수단을 필수로 입력한다.

### 4.11 `transactions`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | Y | FK → `spaces.id` |
| `created_by` | `uuid` | Y | `(space_id, created_by)` → 공간 멤버 |
| `type` | `varchar(20)` | Y | `INCOME`, `EXPENSE` |
| `amount` | `bigint` | Y | CHECK > 0, 원 단위 |
| `occurred_on` | `date` | Y | 실제 거래일 |
| `category_id` | `uuid` | N | `(category_id, space_id)` → 공간 카테고리. 직접 입력 거래는 필수, 미분류 고정비의 자동 생성 거래만 NULL 허용 |
| `payment_method_id` | `uuid` | Y | `(payment_method_id, space_id)` → 공간 결제수단 |
| `memo` | `varchar(500)` | N | 로그 기록 금지 |
| `visibility` | `varchar(20)` | Y | `SHARED`, `PRIVATE` |
| `source` | `varchar(20)` | Y | `MANUAL`, `SCHEDULED_CHARGE` |
| `scheduled_charge_id` | `uuid` | N | `(scheduled_charge_id, space_id)` → 예정 청구 |
| `status` | `varchar(20)` | Y | `ACTIVE`, `VOIDED` |
| `voided_at` | `timestamptz` | N | 완료 취소 시 기록 보존 |
| `voided_by` | `uuid` | N | `(space_id, voided_by)` → 공간 멤버 |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

제약/인덱스:

- CHECK: `source = 'SCHEDULED_CHARGE' OR category_id IS NOT NULL` — 직접 입력 거래는 카테고리 필수

- UNIQUE: `scheduled_charge_id` WHERE NOT NULL — 청구와 자동 거래 1:1
- 자동 생성 거래는 `EXPENSE`, `SHARED`, `SCHEDULED_CHARGE`여야 한다.
- 직접 입력 거래는 `scheduled_charge_id IS NULL`이어야 한다.
- 완료 취소는 연결 거래를 삭제하지 않고 `VOIDED`로 바꾸며, 같은 청구를 재완료하면 새 거래를 만들지 않고 동일 행을 갱신해 `ACTIVE`로 복구한다.
- INDEX: `(space_id, occurred_on DESC)` — 공동 거래 목록
- INDEX: `(created_by, occurred_on DESC)` WHERE `visibility = 'PRIVATE'` — 개인 거래 목록
- 개인 거래 조회는 인증 사용자와 `created_by`가 같은 경우만 허용한다.

### 4.12 같은 공간 참조 규칙

공간 소유 테이블은 PK와 별도로 `UNIQUE (id, space_id)`를 선언한다. 다음 참조는 단일 ID FK가 아니라 공간 ID를 포함한 복합 FK로 정의한다.

| 참조하는 테이블 | 컬럼 | 참조 대상 |
|---|---|---|
| `recurring_expense_revisions` | `(recurring_expense_id, space_id)` | `recurring_expenses(id, space_id)` |
| `recurring_expense_revisions` | `(category_id, space_id)` | `categories(id, space_id)` |
| `recurring_expense_revisions` | `(default_payment_method_id, space_id)` | `payment_methods(id, space_id)` |
| `scheduled_charges` | `(recurring_expense_id, space_id)` | `recurring_expenses(id, space_id)` |
| `scheduled_charges` | `(recurring_expense_revision_id, recurring_expense_id, space_id)` | `recurring_expense_revisions(id, recurring_expense_id, space_id)` |
| `scheduled_charges` | `(category_id, space_id)` | `categories(id, space_id)` |
| `scheduled_charges` | `(planned_payment_method_id, space_id)` | `payment_methods(id, space_id)` |
| `scheduled_charges` | `(actual_payment_method_id, space_id)` | `payment_methods(id, space_id)` |
| `transactions` | `(category_id, space_id)` | `categories(id, space_id)` |
| `transactions` | `(payment_method_id, space_id)` | `payment_methods(id, space_id)` |
| `transactions` | `(scheduled_charge_id, space_id)` | `scheduled_charges(id, space_id)` |

담당자, 작성자와 완료자처럼 사용자 역할이 있는 컬럼은 `(space_id, user_id)`로 `space_members`를 참조한다. 멤버십 행의 존재는 DB가, 현재 `ACTIVE` 상태와 행위 권한은 서버가 검증한다.

모든 상태, 유형, 공개 범위와 출처 문자열에는 허용값 `CHECK`를 둔다. 상태에 따라 필수·NULL이어야 하는 시각과 실제 결제 필드도 `CHECK`로 함께 묶는다.

## 5. 핵심 불변 조건과 보장 수단

| 불변 조건 | 데이터베이스 보장 | 서버 보장 |
|---|---|---|
| 같은 반복 설정·예정일의 청구는 한 건 | UNIQUE `(recurring_expense_id, due_date)` | 생성 재시도 시 기존 행 반환 |
| 예정 청구와 자동 생성 거래는 1:1 | `scheduled_charge_id` 부분 UNIQUE | 완료 트랜잭션에서 함께 생성 |
| 완료 요청 재전송이 거래를 늘리지 않음 | 1:1 UNIQUE | 청구 잠금 후 기존 완료 결과 반환 |
| 완료 수정 시 거래도 동일하게 변경 | FK와 트랜잭션 | 청구·거래를 한 유스케이스에서 갱신 |
| 완료 취소·재완료에도 거래는 한 건 | 상태와 1:1 UNIQUE | 같은 거래를 `VOIDED`/`ACTIVE`로 전환 |
| 완료된 과거 기록은 반복 변경으로 불변 | 청구 스냅샷 | 완료 청구 갱신 차단 |
| 공간 사이 참조가 섞이지 않음 | `(id, space_id)` 복합 FK | 활성 멤버십과 행위 권한 추가 검사 |
| 개인 거래는 작성자만 조회 | 조회 인덱스와 DB 역할 제한 | 모든 API에서 인증 사용자 일치 검사 |
| 공동 데이터는 활성 멤버만 접근 | `space_id` FK | 요청마다 활성 멤버십 검사 |
| 공간 활성 멤버는 최대 2명 | 단순 CHECK만으로 불가 | 공간 행 잠금 후 트랜잭션에서 검사 |

## 6. 생성과 완료 트랜잭션

### 예정 청구 생성

```text
반복 고정비와 적용되는 revision 조회
→ 생성할 예정일 계산
→ 해당 revision의 첫 회차는 기본 예상액, 이후 회차는 별도 변경이 없으면 직전 실제 결제 금액으로 예상 금액 결정
→ INSERT ... ON CONFLICT(recurring_expense_id, due_date) 처리
→ 기존 또는 새 예정 청구 반환
```

### 결제 완료

```text
예정 청구 조회 및 잠금
→ 공간 멤버십과 현재 상태 확인
→ 예정 청구를 완료로 변경
→ scheduled_charge_id가 같은 거래가 없으면 생성
→ 기존 거래가 VOIDED이면 새 실제 값으로 갱신하고 ACTIVE로 복구
→ 이미 ACTIVE이면 기존 완료 결과 반환
→ 다음 발생분 생성 또는 갱신
→ 한 트랜잭션으로 커밋
```

### 완료 취소

```text
예정 청구 조회 및 잠금
→ 공간 멤버십과 완료 상태 확인
→ 예정 청구를 현재 날짜 기준 PENDING 상태로 복귀
→ 연결 거래를 삭제하지 않고 VOIDED로 변경
→ voided_at, voided_by 기록
→ 한 트랜잭션으로 커밋
```

### 반복 고정지출 삭제

```text
반복 고정비와 사용자가 선택한 시작 회차 조회 및 잠금
→ recurring_expenses를 ENDED로 변경
→ ended_at과 ended_from_due_date 기록
→ 선택 회차와 이후의 PENDING 예정 청구를 CANCELLED로 변경
→ 완료 청구와 연결 거래는 변경하지 않음
→ 한 트랜잭션으로 커밋
```

MVP에는 `이번 회차만 삭제`를 제공하지 않는다. 필요하면 향후 `이번 회차만 건너뛰기`라는 별도 기능으로 설계한다. `CANCELLED` 청구는 일반 화면에서 숨기지만 물리 삭제하지 않아 재시도와 조회 시 다시 생성되지 않게 한다.

## 7. 승인된 데이터 정책

2026-10-08 다음 데이터 정책과 구조를 구현 기준으로 승인했다.

- DATA-01: 사용자는 공간 없이 시작하며 `공간 추가`에서 혼자/함께 관리를 선택한다.
- DATA-02: 함께 관리에서 직접 거래를 만들 때 공동/개인을 기본값 없이 매번 명시한다.
- DATA-03: 매월 29~31일이 없는 달은 해당 월의 마지막 날로 조정한다.
- DATA-04: MVP 공간 시간대는 `Asia/Seoul`로 고정하고 날짜 판정도 공간 기준으로 수행한다.
- DATA-05: 결제수단은 대체 수단 없이 보관할 수 있고 향후 회차는 결제수단 미지정 상태를 허용한다.
- DATA-06: 일시 중지는 새 청구 생성만 중단하고 기존 미완료 청구를 유지한다.
- DATA-07: 선택한 회차부터 반복 고정지출을 종료하고 그 회차와 이후 미완료 청구를 취소한다.
- DATA-08: 완료 취소와 재완료는 자동 생성 거래 한 행의 `VOIDED`/`ACTIVE` 전환으로 처리한다.
- DATA-09: 초대는 발급 후 24시간에 만료한다.
- DATA-10: 예정 청구는 서버만 생성하고 등록·월간 조회·완료 시 누락분을 멱등 보충한다. MVP에는 일일 생성 작업을 두지 않는다.
- DATA-11: 고정비 최초 등록은 비용명·예상 금액·반복 주기·첫 예정일만 필수이며 카테고리·담당자·결제수단은 나중에 지정할 수 있다.

추가로 다음 구조를 구현 기준으로 승인했다.

- 모든 공간 소유 참조는 가능한 범위에서 `(id, space_id)` 복합 FK로 보호한다.
- 기본 카테고리는 공간 생성 시 공간별 카테고리로 생성하고 전역 카테고리 행을 공유하지 않는다.
- 반복 설정의 다음 회차부터 변경은 `recurring_expense_revisions`로 기록한다.
- 외부 인증 주체는 `auth_identities`에서 내부 사용자와 분리한다.
- 미래 금융 연동 데이터는 핵심 거래에 직접 섞지 않고 별도 수집·매칭 경계를 둔다.

## 8. 미래 금융 연동 확장 경계

MVP에는 금융 연동 테이블을 생성하지 않는다. 카드·은행 거래 자동 수집을 시작할 때 다음 책임을 별도 모듈로 추가한다.

| 미래 엔티티 | 책임 |
|---|---|
| `financial_connections` | 제공자 연결, 사용자 동의 상태, 암호화된 자격 증명 참조와 동기화 cursor |
| `external_accounts` | 제공자가 식별한 카드·계좌와 내부 `payment_methods`의 선택적 연결 |
| `imported_transactions` | 제공자 거래 ID, 승인 대기·확정·삭제 상태와 정규화 전후 값의 멱등 수집 |
| `transaction_matches` | 수집 거래와 예정 청구 또는 내부 거래의 매칭 및 사용자 확인 상태 |

확장 원칙:

- `payment_methods`에는 제공자 token, 동기화 cursor와 원본 응답을 추가하지 않는다.
- 제공자의 거래 ID는 연결 범위 안에서 UNIQUE로 관리한다.
- 승인 대기 거래가 확정 거래로 교체되거나 삭제될 수 있음을 전제로 한다.
- 수집 거래를 기존 자동 생성 거래와 매칭하기 전에 합계에 더하지 않는다.
- provider token과 secret은 평문으로 저장하거나 로그에 남기지 않는다.

## 9. 구현 전 검증 항목

- 복합 FK가 다른 `space_id`의 카테고리, 결제수단, 반복 설정과 청구 참조를 거부하는지 검증한다.
- UNIQUE 제약 충돌을 정상적인 멱등 결과로 변환하는 테스트를 작성한다.
- 두 완료 요청을 동시에 실행해도 자동 거래가 한 건인지 검증한다.
- 완료 취소 후 재완료해도 같은 자동 거래 행 하나만 존재하는지 검증한다.
- 다른 공간 사용자와 같은 공간의 다른 멤버가 개인 거래를 조회할 수 없는지 검증한다.
- 완료 수정·취소 실패 시 청구와 거래가 부분 반영되지 않는지 검증한다.
- 새 revision 적용 전후의 미완료 청구와 완료 청구가 각각 올바른 설정을 유지하는지 검증한다.
- 반복 고정지출 삭제가 선택 회차와 이후 미완료 청구만 취소하고 완료 기록은 유지하는지 검증한다.
- 결제수단 보관 후 미래 청구가 미지정 상태가 되고 완료 시 실제 결제수단을 요구하는지 검증한다.
- 카테고리·담당자·결제수단 없이 고정비와 예정 청구가 생성되고 미지정 상태로 조회되는지 검증한다.
- 미분류 자동 생성 거래는 허용하되 직접 입력 거래의 카테고리 누락은 거부하는지 검증한다.
- 월말, 윤년, 공간 시간대 자정 경계를 결정한 정책에 맞게 검증한다.

## 10. 인덱스와 삭제 정책

- PostgreSQL이 FK의 참조하는 쪽 인덱스를 자동 생성하지 않으므로 실제 조회와 삭제 경로에 필요한 FK 인덱스를 명시한다.
- 월간 타임라인은 `(space_id, due_date)`를, 미완료 조회는 `status = 'PENDING'` 부분 인덱스를 우선 검토한다.
- 공동 거래는 `(space_id, occurred_on DESC)`에 `visibility = 'SHARED' AND status = 'ACTIVE'` 조건을 검토한다.
- 개인 거래는 `(space_id, created_by, occurred_on DESC)`에 `visibility = 'PRIVATE' AND status = 'ACTIVE'` 조건을 검토한다.
- 금융 기록과 완료 이력에는 무조건적인 `ON DELETE CASCADE`를 사용하지 않는다.
- 참조 중인 카테고리와 결제수단은 물리 삭제하지 않고 보관 상태로 전환한다.
- 실제 인덱스는 대표 쿼리의 실행 계획을 확인한 뒤 확정하며 선제적으로 중복 생성하지 않는다.

## 11. 다음 단계

1. Phase 3에서 핵심 화면 흐름과 저충실도 와이어프레임을 승인한다.
2. Phase 4에서 승인된 흐름을 API 계약으로 변환한다.
3. 인증 정책을 별도 확정한 뒤 프로젝트 소스와 Flyway migration을 초기화한다.
