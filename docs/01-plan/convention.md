# 한달살림 개발 규칙과 프로젝트 구조

> 상태: Approved
>
> 승인일: 2026-10-08
>
> 목적: 웹과 API를 일관되게 구현하고 Codex가 실행 가능한 검사로 변경을 검증할 수 있는 최소 규칙을 정한다.

## 1. 기술 기준선

| 영역 | 선택 | 버전 정책 |
|---|---|---|
| Java | Eclipse Temurin Java 21 LTS | 21 최신 보안 패치 사용 |
| API | Spring Boot | 4.1.x 최신 패치 사용 |
| 빌드 | Gradle Wrapper, Groovy DSL | Spring Initializr가 생성한 호환 Gradle 9.x를 저장소에 고정 |
| 데이터 접근 | Spring Data JPA | Spring Boot BOM으로 관리 |
| 스키마 변경 | Flyway | migration을 DB 스키마의 진실의 원천으로 사용 |
| 데이터베이스 | PostgreSQL | 18 최신 패치 사용 |
| 웹 런타임 | Node.js 24 LTS | 24 최신 보안 패치 사용 |
| 웹 | Next.js App Router, React | Next.js 16.4.x, React 19.3.x |
| 언어 | TypeScript | 7.0.x, strict mode |
| 패키지 관리 | pnpm | 12.x, lockfile과 `packageManager` 필드로 고정 |

정확한 patch 버전과 생성된 Wrapper 버전은 프로젝트 초기화 시 공식 생성기의 결과를 검증한 뒤 커밋한다. 전역 Gradle과 전역 pnpm 버전에 의존하지 않는다.

## 2. 저장소 구조

한 Git 저장소에 독립 배포 가능한 웹과 API를 함께 두는 단순 다중 언어 모노레포를 사용한다.

```text
handal-sallim/
├── apps/
│   ├── web/                 # Next.js 프런트엔드
│   └── api/                 # Spring Boot 백엔드 API
├── infra/
│   └── compose.yaml         # 로컬 PostgreSQL 등 공용 개발 인프라
├── docs/                    # 기획, 설계와 개발 규칙
├── AGENTS.md
└── README.md
```

- Nx, Turborepo와 별도 모노레포 프레임워크는 도입하지 않는다.
- 웹은 pnpm, API는 Gradle Wrapper로 각각 빌드한다.
- 프런트엔드와 백엔드는 독립 실행·테스트·배포 단위를 유지한다.
- API 계약이나 한 기능이 양쪽에 영향을 줄 때는 하나의 PR에서 함께 변경할 수 있다.
- 공용 Docker Compose와 저장소 수준 CI만 루트에서 관리한다.

## 3. 공통 원칙

- 기능 단위로 파일을 모으고 전역 `controllers`, `services`, `utils` 폴더가 무제한으로 커지지 않게 한다.
- 금액, 반복 일정, 공개 범위와 권한 규칙은 프레임워크 코드와 분리해 테스트할 수 있게 한다.
- API, 데이터베이스, 환경 변수와 사용자 입력은 경계에서 검증한다.
- 코드 생성이나 추상화는 실제 중복이 확인된 뒤 도입한다.
- 한 파일은 하나의 주된 책임을 가지며 이름으로 역할을 알 수 있게 한다.
- 주석은 코드가 무엇을 하는지 반복하지 않고 결정 이유와 불변 조건을 설명할 때만 사용한다.
- secret, token, 개인정보와 거래 메모를 코드, fixture, snapshot과 로그에 넣지 않는다.

## 4. API 프로젝트 규칙

### 4.1 패키지 구성

기본 패키지는 `com.handalsallim`으로 하고 기능 중심으로 구성한다.

```text
com.handalsallim
├── shared/
├── space/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── persistence/
├── paymentmethod/
├── recurringexpense/
└── transaction/
```

- `api`: HTTP 요청·응답, 입력 검증과 상태 코드 변환
- `application`: 유스케이스, 권한 검사와 트랜잭션 경계
- `domain`: 프레임워크와 분리된 상태·계산·불변 조건
- `persistence`: JPA entity, repository와 DB adapter
- 작은 기능은 빈 하위 패키지를 미리 만들지 않고 필요할 때 분리한다.
- 의존 방향은 `api → application → domain`을 기본으로 하며 domain이 Spring MVC나 JPA에 의존하지 않게 한다.

### 4.2 Java 이름과 코드 스타일

| 대상 | 규칙 | 예시 |
|---|---|---|
| package | 소문자 | `recurringexpense` |
| class, record, enum | PascalCase | `ScheduledCharge` |
| method, field | camelCase | `completeCharge` |
| constant | UPPER_SNAKE_CASE | `MAX_ACTIVE_MEMBERS` |
| 테스트 | 대상과 행위를 표현 | `CompleteScheduledChargeTest` |
| REST path | 소문자 kebab-case, 복수 명사 | `/scheduled-charges` |
| DB 객체 | snake_case | `scheduled_charges` |

- Java 소스에는 Lombok과 MapStruct를 기본 도입하지 않는다.
- API 요청·응답에는 Java `record`를 우선 검토하고 JPA entity를 직접 반환하지 않는다.
- 서비스에서 raw exception과 DB 오류를 HTTP 응답으로 노출하지 않는다.
- 여러 행을 변경하는 유스케이스의 `@Transactional`은 application 계층에 둔다.
- Hibernate 자동 DDL 생성은 사용하지 않고 운영·테스트 모두 Flyway migration을 적용한다.
- Hibernate `ddl-auto`는 `validate`를 사용해 entity와 migration 차이를 검출한다.
- 조회 편의를 위한 양방향 JPA 연관관계는 기본적으로 만들지 않는다.

## 5. 웹 프로젝트 규칙

### 5.1 디렉터리 구성

```text
apps/web/src/
├── app/                     # Next.js route, layout과 route-level composition
├── features/                # 고정비, 결제수단, 거래 등 기능 모듈
├── shared/
│   ├── api/                 # Spring API client와 경계 검증
│   ├── ui/                  # 재사용 UI primitive
│   ├── lib/                 # 범용 순수 함수
│   └── config/              # 공개 가능한 런타임 설정
└── test/                    # 공용 테스트 설정과 fixture builder
```

- `app`은 화면 조합과 라우팅을 담당하고 도메인 계산을 소유하지 않는다.
- 기능 전용 코드와 테스트는 `features/<feature>`에 함께 둔다.
- Server Component를 기본으로 하고 브라우저 상태나 이벤트가 필요한 경계에만 `'use client'`를 사용한다.
- 화면 컴포넌트가 `fetch`를 직접 흩어 호출하지 않게 기능별 API 함수 뒤에 둔다.
- 서버 응답은 TypeScript 타입 단언만 하지 않고 런타임 경계에서 검증한다.

### 5.2 TypeScript와 파일 이름

| 대상 | 규칙 | 예시 |
|---|---|---|
| React component 파일·export | PascalCase | `PaymentMethodCard.tsx` |
| hook | `use` + PascalCase | `useScheduledCharges.ts` |
| 순수 유틸리티 파일 | camelCase | `calculateMonthlyTotal.ts` |
| CSS Module | kebab-case | `payment-method-card.module.css` |
| 변수·함수 | camelCase | `scheduledCharges` |
| type·interface | PascalCase | `ScheduledChargeResponse` |
| 상수 | UPPER_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |

- `strict`를 켜고 명시적 `any`를 금지한다. 외부 값은 `unknown`에서 검증한다.
- 객체 모델은 `interface`, union·교차·utility 타입은 `type`을 기본으로 한다.
- 고정 문자열 집합은 TypeScript `enum`보다 string union 또는 `as const`를 우선한다.
- boolean은 가능하면 `is`, `has`, `can`, `should` 접두사를 사용한다.
- 이벤트 구현은 `handle*`, callback prop은 `on*` 이름을 사용한다.
- barrel export는 공개 경계가 분명한 기능 루트에서만 사용하고 순환 의존을 만들지 않는다.

## 6. API와 데이터 규칙

- API JSON은 `camelCase`, 데이터베이스 객체는 `snake_case`를 사용한다.
- 날짜만 의미하면 ISO `YYYY-MM-DD`, 사건 시각은 UTC ISO 8601 문자열을 사용한다.
- 원화 금액은 소수 없는 정수이며 Java에서는 `long`, TypeScript에서는 안전 범위를 검증한 `number`를 사용한다.
- JavaScript 안전 정수 범위를 넘길 가능성이 생기면 API 금액 표현을 문자열로 전환하는 별도 결정을 한다.
- UUID는 API에서 문자열로 전달하되 클라이언트가 만든 사용자·공간 ID를 권한 근거로 신뢰하지 않는다.
- 목록 응답과 오류 응답 형식은 API 설계 단계에서 일관된 계약으로 확정한다.

## 7. 테스트 규칙

- 순수 도메인 규칙은 프레임워크 없는 단위 테스트로 가장 먼저 보호한다.
- API 통합 테스트는 실제 PostgreSQL과 같은 동작을 확인할 수 있도록 Testcontainers를 사용한다.
- repository 테스트를 H2 결과만으로 통과시키지 않는다.
- 웹 단위·컴포넌트 테스트는 Vitest와 Testing Library를 사용한다.
- 핵심 사용자 흐름은 Playwright로 Chrome과 Edge 계열을 자동 검증하고 실제 iPhone Safari는 출시 전 수동 교차 검증한다.
- 테스트 이름은 내부 구현이 아니라 사용자 행위와 기대 결과를 표현한다.
- 시간, UUID와 현재 사용자는 테스트에서 주입 가능하게 만든다.

## 8. 포맷과 정적 검사

- Java는 프로젝트 초기화 시 선택한 formatter를 Gradle 작업으로 고정한다.
- TypeScript는 ESLint와 Prettier를 사용하며 설정은 저장소에 커밋한다.
- 생성 코드와 migration은 포맷 도구의 무분별한 자동 수정 대상에서 제외한다.
- 경고를 장기간 방치하지 않으며 CI에서는 승인된 검사 작업의 실패를 병합 차단 조건으로 사용한다.
- 실제 실행 명령은 프로젝트 초기화 후 Windows에서 성공을 확인한 뒤 `AGENTS.md`와 README에 기록한다.

## 9. Git 규칙

- 브랜치와 커밋 형식은 루트 `AGENTS.md`를 따른다.
- 소스 초기 단계에는 Husky와 commitlint를 도입하지 않는다. 규칙 위반이 실제로 반복될 때 자동화를 검토한다.
- 프런트엔드와 백엔드를 함께 바꾸는 기능도 하나의 논리적 변경과 검증 가능한 PR로 유지한다.
- dependency lockfile, Gradle Wrapper와 Flyway migration은 코드와 함께 검토한다.

## 10. 초기화 후 보완 항목

- 생성된 정확한 Java, Spring Boot, Gradle, Node.js, Next.js, React, TypeScript와 pnpm patch 버전
- Windows 설치 및 실행 절차
- 웹과 API의 포맷, 린트, 타입 검사, 단위·통합 테스트와 빌드 명령
- Docker Compose 실행·종료와 데이터 초기화 절차
- CI job과 필수 병합 조건
- 실제 formatter와 런타임 응답 검증 도구
