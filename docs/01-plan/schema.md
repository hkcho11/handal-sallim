# 한달살림 핵심 데이터 스키마

> 상태: Draft — 사용자 승인 전 구현 기준으로 사용하지 않음
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
- 화면에서 전달한 사용자·공간 식별자를 권한 근거로 신뢰하지 않는다.
- 반복 설정, 예정 청구와 실제 거래를 별도 엔티티로 유지한다.
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
| `version` | `bigint` | NOT NULL, 기본값 0, 낙관적 잠금에 사용 |

물리 삭제 대신 보관이 필요한 엔티티에는 상태와 `archived_at` 또는 `voided_at`을 사용한다. 무조건적인 `deleted_at` 추가는 피하고 엔티티별 보존 의미를 명확히 한다.

## 3. 엔티티 목록

| 엔티티 | 테이블 | 책임 |
|---|---|---|
| 사용자 | `users` | 애플리케이션 사용자 식별과 표시 정보 |
| 관리 공간 | `spaces` | 혼자/함께 관리 데이터의 최상위 권한 경계 |
| 공간 멤버십 | `space_members` | 사용자와 공간의 활성 관계 및 역할 |
| 초대 | `invitations` | 만료형·일회용 참여 자격 증명 |
| 카테고리 | `categories` | 시스템 기본 및 공간별 분류 기준 |
| 결제수단 | `payment_methods` | 카드·계좌·현금의 안전한 표시 정보 |
| 반복 고정비 설정 | `recurring_expenses` | 반복 규칙과 기본값 원본 |
| 예정 청구 | `scheduled_charges` | 특정 예정일에 발생한 회차 스냅샷 |
| 실제 거래 | `transactions` | 실제 수입·지출과 공개 범위 |

## 4. 필드 정의

### 4.1 `users`

인증 수단과 분리된 애플리케이션 사용자다.

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `auth_subject` | `varchar(255)` | 조건부 | 인증 제공자 확정 후 UNIQUE. 인증 설계 전에는 의미만 예약 |
| `display_name` | `varchar(100)` | Y | 관계나 성별을 전제하지 않는 표시명 |
| `status` | `varchar(20)` | Y | `ACTIVE`, `DEACTIVATED` |
| `created_at` | `timestamptz` | Y | 생성 시각 |
| `updated_at` | `timestamptz` | Y | 변경 시각 |

이메일과 전화번호는 인증 방식이 확정되기 전까지 핵심 사용자 테이블에 추가하지 않는다.

### 4.2 `spaces`

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
- 한 사용자의 활성 관리 공간은 MVP에서 하나만 허용한다.

### 4.3 `space_members`

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

### 4.4 `invitations`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | Y | FK → `spaces.id` |
| `invited_by` | `uuid` | Y | FK → `users.id` |
| `token_hash` | `varchar(255)` | Y | UNIQUE, 원문 저장 금지 |
| `status` | `varchar(20)` | Y | `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED` |
| `expires_at` | `timestamptz` | Y | 만료 시각 |
| `accepted_by` | `uuid` | N | FK → `users.id` |
| `accepted_at` | `timestamptz` | N | 수락 시각 |
| `revoked_at` | `timestamptz` | N | 취소 시각 |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

수락은 초대 상태 확인, 만료 검사, 멤버 수 확인, 멤버십 생성과 공간 상태 변경을 한 트랜잭션으로 처리한다.

### 4.5 `categories`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | N | NULL이면 시스템 기본, 값이 있으면 공간 사용자 정의 |
| `name` | `varchar(80)` | Y | 표시명 |
| `applies_to` | `varchar(20)` | Y | `EXPENSE`, `INCOME`, `BOTH` |
| `status` | `varchar(20)` | Y | `ACTIVE`, `ARCHIVED` |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

공간별 활성 카테고리 이름 중복을 막는 부분 UNIQUE 인덱스를 둔다.

### 4.6 `payment_methods`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | Y | FK → `spaces.id` |
| `holder_user_id` | `uuid` | N | FK → `users.id`, 명의자/담당자 |
| `name` | `varchar(100)` | Y | 사용자가 정한 표시명 |
| `type` | `varchar(20)` | Y | `CARD`, `ACCOUNT`, `CASH` |
| `color` | `varchar(20)` | N | 허용 형식을 경계에서 검증 |
| `status` | `varchar(20)` | Y | `ACTIVE`, `ARCHIVED` |
| `archived_at` | `timestamptz` | N | 보관 시각 |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

실제 카드번호·계좌번호 전체를 저장하는 필드는 만들지 않는다. 사용 중인 결제수단은 삭제 대신 보관을 기본 제안으로 한다.

### 4.7 `recurring_expenses`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | Y | FK → `spaces.id` |
| `name` | `varchar(120)` | Y | 비용명 |
| `category_id` | `uuid` | Y | FK → `categories.id` |
| `interval_months` | `smallint` | Y | CHECK IN `(1, 2, 3, 12)` |
| `first_due_date` | `date` | Y | 첫 발생 기준 예정일 |
| `initial_expected_amount` | `bigint` | Y | CHECK > 0, 원 단위 |
| `assignee_user_id` | `uuid` | Y | FK → `users.id`, 담당자 |
| `default_payment_method_id` | `uuid` | Y | FK → `payment_methods.id` |
| `status` | `varchar(20)` | Y | `ACTIVE`, `PAUSED`, `ENDED` |
| `paused_at` | `timestamptz` | N | 일시 중지 시각 |
| `ended_at` | `timestamptz` | N | 종료 시각 |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

반복 설정 변경은 이미 생성된 완료 청구를 수정하지 않는다. 한 회차만 변경할 때는 예정 청구 스냅샷을, 다음 회차부터 변경할 때는 반복 설정과 아직 확정되지 않은 미래 청구만 변경한다.

### 4.8 `scheduled_charges`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | Y | FK → `spaces.id`, 권한/조회 경계 |
| `recurring_expense_id` | `uuid` | Y | FK → `recurring_expenses.id` |
| `due_date` | `date` | Y | 해당 회차 예정일 |
| `expense_name` | `varchar(120)` | Y | 발생 당시 비용명 스냅샷 |
| `category_id` | `uuid` | Y | 발생 당시 카테고리 |
| `expected_amount` | `bigint` | Y | CHECK > 0 |
| `assignee_user_id` | `uuid` | Y | 발생 당시 담당자 |
| `planned_payment_method_id` | `uuid` | Y | 발생 당시 기본 결제수단 |
| `status` | `varchar(20)` | Y | `PENDING`, `COMPLETED`, `CANCELLED` |
| `actual_amount` | `bigint` | N | 완료 시 CHECK > 0 |
| `actual_paid_on` | `date` | N | 완료 시 실제 결제일 |
| `actual_payment_method_id` | `uuid` | N | 완료 시 FK → `payment_methods.id` |
| `completed_by` | `uuid` | N | FK → `users.id` |
| `completed_at` | `timestamptz` | N | 완료 시각 |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

제약/인덱스:

- UNIQUE: `(recurring_expense_id, due_date)` — 같은 회차 중복 생성 방지
- INDEX: `(space_id, due_date, status)` — 월간 타임라인과 리마인드
- 완료 상태이면 실제 금액·날짜·결제수단·완료자·완료시각이 모두 존재하는 CHECK
- `PENDING`이고 `due_date`가 현지 오늘보다 이전이면 조회 결과에서 `OVERDUE`로 표현

### 4.9 `transactions`

| 필드 | 타입 | 필수 | 제약/설명 |
|---|---|---:|---|
| `id` | `uuid` | Y | PK |
| `space_id` | `uuid` | Y | FK → `spaces.id` |
| `created_by` | `uuid` | Y | FK → `users.id` |
| `type` | `varchar(20)` | Y | `INCOME`, `EXPENSE` |
| `amount` | `bigint` | Y | CHECK > 0, 원 단위 |
| `occurred_on` | `date` | Y | 실제 거래일 |
| `category_id` | `uuid` | Y | FK → `categories.id` |
| `payment_method_id` | `uuid` | Y | FK → `payment_methods.id` |
| `memo` | `varchar(500)` | N | 로그 기록 금지 |
| `visibility` | `varchar(20)` | Y | `SHARED`, `PRIVATE` |
| `source` | `varchar(20)` | Y | `MANUAL`, `SCHEDULED_CHARGE` |
| `scheduled_charge_id` | `uuid` | N | FK → `scheduled_charges.id` |
| `status` | `varchar(20)` | Y | `ACTIVE`, `VOIDED` 제안 |
| `voided_at` | `timestamptz` | N | 완료 취소 시 기록 보존 제안 |
| `voided_by` | `uuid` | N | FK → `users.id` |
| 공통 필드 |  |  | `created_at`, `updated_at`, `version` |

제약/인덱스:

- UNIQUE: `scheduled_charge_id` WHERE NOT NULL — 청구와 자동 거래 1:1
- 자동 생성 거래는 `EXPENSE`, `SHARED`, `SCHEDULED_CHARGE`여야 한다.
- 직접 입력 거래는 `scheduled_charge_id IS NULL`이어야 한다.
- INDEX: `(space_id, occurred_on DESC)` — 공동 거래 목록
- INDEX: `(created_by, occurred_on DESC)` WHERE `visibility = 'PRIVATE'` — 개인 거래 목록
- 개인 거래 조회는 인증 사용자와 `created_by`가 같은 경우만 허용한다.

## 5. 핵심 불변 조건과 보장 수단

| 불변 조건 | 데이터베이스 보장 | 서버 보장 |
|---|---|---|
| 같은 반복 설정·예정일의 청구는 한 건 | UNIQUE `(recurring_expense_id, due_date)` | 생성 재시도 시 기존 행 반환 |
| 예정 청구와 자동 생성 거래는 1:1 | `scheduled_charge_id` 부분 UNIQUE | 완료 트랜잭션에서 함께 생성 |
| 완료 요청 재전송이 거래를 늘리지 않음 | 1:1 UNIQUE | 청구 잠금 후 기존 완료 결과 반환 |
| 완료 수정 시 거래도 동일하게 변경 | FK와 트랜잭션 | 청구·거래를 한 유스케이스에서 갱신 |
| 완료 취소 시 합계에서 함께 제외 | 상태와 트랜잭션 | 청구 복귀·거래 무효화를 원자 처리 |
| 완료된 과거 기록은 반복 변경으로 불변 | 청구 스냅샷 | 완료 청구 갱신 차단 |
| 개인 거래는 작성자만 조회 | 조회 인덱스와 DB 역할 제한 | 모든 API에서 인증 사용자 일치 검사 |
| 공동 데이터는 활성 멤버만 접근 | `space_id` FK | 요청마다 활성 멤버십 검사 |
| 공간 활성 멤버는 최대 2명 | 단순 CHECK만으로 불가 | 공간 행 잠금 후 트랜잭션에서 검사 |

## 6. 생성과 완료 트랜잭션

### 예정 청구 생성

```text
반복 설정 조회 및 잠금
→ 생성할 예정일 계산
→ 최초 회차는 사용자 입력값, 이후 회차는 직전 실제 결제 금액으로 예상 금액 결정
→ INSERT ... ON CONFLICT(recurring_expense_id, due_date) 처리
→ 기존 또는 새 예정 청구 반환
```

### 결제 완료

```text
예정 청구 조회 및 잠금
→ 공간 멤버십과 현재 상태 확인
→ 예정 청구를 완료로 변경
→ scheduled_charge_id가 같은 거래 생성
→ 중복이면 기존 완료 결과 반환
→ 다음 발생분 생성 또는 갱신
→ 한 트랜잭션으로 커밋
```

## 7. 결정 대기 목록

아래 항목은 데이터 공개 범위, 날짜 또는 기록 보존에 영향을 주므로 사용자 승인 후 확정한다.

| ID | 결정 | 추천안 | 영향 |
|---|---|---|---|
| DATA-01 | 혼자/함께 관리 내부 모델 | 처음부터 모든 사용자가 하나의 공간과 멤버십을 가짐 | 전환 시 데이터 이동 없이 두 번째 멤버만 추가 가능 |
| DATA-02 | 함께 관리의 새 직접 거래 공개 기본값 | 기본값 없이 매번 공동/개인을 명시 | 실수로 개인 거래가 공개되는 위험 최소화 |
| DATA-03 | 매월 29~31일이 없는 달 처리 | 해당 월의 마지막 날로 조정 | 청구를 건너뛰지 않고 예측 가능 |
| DATA-04 | 날짜와 시간대 | MVP 공간 시간대는 `Asia/Seoul`로 고정하고 날짜 판정도 공간 기준으로 수행 | 자정 경계의 일관성을 유지하고 시간대 변경 문제를 MVP 밖으로 제한 |
| DATA-05 | 사용 중인 결제수단 제거 | 물리 삭제 금지. 활성 반복 설정에 연결되어 있으면 대체 수단 지정 후 `ARCHIVED` 처리 | 과거 참조를 보존하면서 이후 청구의 결제수단 공백 방지 |
| DATA-06 | 반복 설정 일시 중지 | 새 청구 생성만 중단하고 기존 미완료 청구 유지 | 이미 예정된 비용을 조용히 제거하지 않음 |
| DATA-07 | 반복 설정 종료 | 종료일 이후 미완료 미래 청구는 명시적 확인 후 취소 | 기록 보존과 사용자 의도 확인 |
| DATA-08 | 완료 취소의 자동 거래 | 삭제하지 않고 `VOIDED`로 보존 | 감사 가능성과 합계 일관성 확보 |
| DATA-09 | 초대 만료 시간 | 발급 후 72시간 | 사용 편의와 노출 기간의 균형 |
| DATA-10 | 예정 청구 생성 책임과 시점 | 서버만 생성하며 등록 시 첫 회차를 만들고, 일일 작업과 조회 시 복구 로직이 다음 달 말까지 멱등 생성 | 브라우저 실행 여부와 무관하게 누락을 복구하고 현재·다음 일정을 제공 |

## 8. 구현 전 검증 항목

- 각 FK가 같은 `space_id`의 엔티티만 참조하도록 서버와 통합 테스트에서 검증한다.
- UNIQUE 제약 충돌을 정상적인 멱등 결과로 변환하는 테스트를 작성한다.
- 두 완료 요청을 동시에 실행해도 자동 거래가 한 건인지 검증한다.
- 다른 공간 사용자와 같은 공간의 다른 멤버가 개인 거래를 조회할 수 없는지 검증한다.
- 완료 수정·취소 실패 시 청구와 거래가 부분 반영되지 않는지 검증한다.
- 월말, 윤년, 공간 시간대 자정 경계를 결정한 정책에 맞게 검증한다.

## 9. 다음 단계

1. 결정 대기 목록을 사용자와 확정한다.
2. 확정 결과를 이 문서와 `SERVICE_PLAN.md`에 반영한다.
3. PostgreSQL DDL이 아니라 기술 독립적인 도메인 모델부터 검토한다.
4. Phase 2에서 Java/TypeScript 네이밍, 디렉터리와 migration 규칙을 확정한다.
