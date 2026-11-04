# 한달살림

반복 생활비를 관리하는 반응형 웹 서비스입니다. 이메일·비밀번호 로그인, 반복 생활비와 수입·저축을 관리하는 웹과 API를 포함합니다. 제품 요구사항은 [SERVICE_PLAN.md](SERVICE_PLAN.md)를 따릅니다.

## 고정비 결제 완료와 반복 회차

2026-11-04 변경: 새 등록에서 금액 변동 여부를 먼저 선택합니다. 금액 변동은 해당 월로 등록하고 상세에서 월·금액·결제일·결제수단을 수동 입력하는 즉시 완료 지출로 기록합니다. 금액 일정은 반복 결제일에 완료 내역을 자동 기록하고 각 내역을 수정할 수 있습니다. 집계는 해당 월 기준입니다. 기존 항목은 직접 새 유형을 선택하기 전까지 보존합니다. 상세 정책은 [고정비 결제 유형](docs/02-design/expense-billing-modes.md)을 따르며, 아래 기존 완료 처리 설명보다 새 유형에 우선합니다.

고정비 상세의 `회차별 결제 내역`에서 결제 완료를 누르고 실제 금액·결제일·결제수단을 확인합니다. 실제 금액은 빈칸에서 입력하며 결제일 기본값은 예정일입니다. 미래 실제 결제일은 허용하지 않습니다. 완료하면 실제 지출이 한 건 생성되고 반복 설정에 따라 다음 회차가 이어집니다. 재시도해도 거래는 중복되지 않습니다.

등록 금액은 고정비 정보에 남기고, 이후 미결제 회차는 예상액 없이 상태만 표시합니다. 홈 합계와 차트는 완료한 실제 결제액만 사용하며 미결제만 있는 달을 0원 지출로 비교하지 않습니다. 빠진 과거 회차도 반복 설정에 따라 생성하지만 자동으로 결제 완료 처리하지 않습니다. 상세 정책은 `SERVICE_PLAN.md`의 1.1.6을 따릅니다.

## 구성

- `apps/web`: Next.js App Router, React, TypeScript 웹
- `apps/api`: Spring Boot API, JPA, Flyway
- `infra/compose.yaml`: 로컬 PostgreSQL 18과 Mailpit 인증 메일함
- `docs`: 제품·설계·개발 규칙

## 버전

| 구성 | 고정 버전 |
|---|---|
| Node.js | 24.21.0 (pnpm이 프로젝트용 런타임을 설치) |
| pnpm | 12.10.1 |
| Next.js | 16.3.8 |
| React | 19.3.0 |
| TypeScript | 7.0.2 타입 검사, 6.0.2 ESLint 호환 API |
| Java | 21 |
| Spring Boot | 4.1.1 |
| Gradle Wrapper | 9.7.1 |
| Java formatter | Spotless 8.10.3, google-java-format 1.36.1 |
| PostgreSQL | 18.6 |

Next.js 16.4.x가 아직 배포되지 않아 승인받은 16.3.8로 시작했습니다. 16.4.x가 출시되면 호환성 검사 후 올립니다. TypeScript 7은 컴파일러 API를 제공하지 않아 ESLint용 TypeScript 6 호환 패키지를 함께 설치했습니다.

## 로컬 실행

PowerShell에서 루트 디렉터리 기준으로 실행합니다. Docker Desktop을 먼저 시작하고, 개인용 DB 비밀번호를 현재 셸의 `DB_PASSWORD` 환경 변수에 설정합니다. 비밀번호를 저장소 파일에 넣지 마세요.

```powershell
docker compose -f infra/compose.yaml up -d --wait
npx --yes pnpm@12.10.1 --dir apps/web install --frozen-lockfile
npx --yes pnpm@12.10.1 --dir apps/web exec next dev --hostname 127.0.0.1
```

API는 아래 로컬 실행 도구로 시작합니다. 실행 도구는 준비 상태를 확인하고 비정상 종료·연속 연결 실패 시 자동 재시작합니다. 이미 실행 중인 로컬 PostgreSQL이 하나라면 컨테이너의 DB 비밀번호를 메모리로 읽어 사용하며 파일이나 로그에는 남기지 않습니다. 별도 DB를 쓰면 `DB_URL`, `DB_USER`, `DB_PASSWORD`를 먼저 설정하세요.

```powershell
.\scripts\api-dev.ps1 -Action Start
.\scripts\api-dev.ps1 -Action Status
# Java 코드나 Flyway migration을 수정했을 때 재빌드 후 재시작
.\scripts\api-dev.ps1 -Action Restart
# 자동 재시작까지 함께 중단
.\scripts\api-dev.ps1 -Action Stop
```

실행 도구는 `bootJar`를 빌드한 뒤 `.local/api`에 고유한 실행 사본을 만듭니다. 실행 중인 JAR은 다른 빌드가 덮어쓰지 않으므로 검증·빌드 중 클래스 로딩이 깨지는 문제를 피합니다. 로그와 PID·시작 시각은 `.local/api`에 저장되고 Git에서 제외됩니다. 시작 명령을 반복해도 서버가 중복 실행되지 않으며, 종료 명령은 이 도구가 관리하는 프로세스만 중단합니다. PC 재부팅 뒤에는 `Start`를 다시 실행해야 합니다. 기존에 직접 실행한 API가 8081 포트를 사용하고 있다면 해당 API를 먼저 종료하세요.

`local` 프로필은 기존 `admin` 사용자와 개인 공간을 보존하지만 자동 로그인하지 않습니다. 실제 가입·로그인이 필요하며 API는 `127.0.0.1`에서만 열립니다. Java 코드와 migration 변경은 `Restart`로 반영하며 웹 새로고침만으로는 적용되지 않습니다. API 프로세스 종료와 빌드 중 실행 사본 보존 검증은 `.\scripts\test-api-dev.ps1`로 실행합니다. 이 검사는 실행 중인 로컬 API를 의도적으로 종료한 뒤 자동 복구를 확인합니다.

웹은 `http://localhost:3000`, API는 `http://localhost:8081`에서 실행됩니다. 웹의 `/backend/*` 요청은 서버 Route Handler가 기본 API의 8081 포트로 전달하며, 연결 불가·10초 시간 초과 시 내부 오류를 노출하지 않는 `503`과 재시도 안내를 반환합니다. 쓰기 요청은 자동 재전송하지 않습니다. 다른 주소를 쓸 때는 웹 서버 실행 환경의 `API_ORIGIN`을 설정합니다. 고정비 등록·목록 API는 `/api/recurring-expenses`에 있습니다. 모든 프로필에서 API는 로그인 세션의 사용자와 공간 권한을 검사합니다. 프론트와 API 모두 로컬 컴퓨터에서만 접근할 수 있게 실행합니다. PostgreSQL 중지 시 `docker compose -f infra/compose.yaml down`을 사용하면 데이터 볼륨은 유지됩니다.

## 검사

```powershell
npx --yes pnpm@12.10.1 --dir apps/web run format:check
npx --yes pnpm@12.10.1 --dir apps/web run lint
npx --yes pnpm@12.10.1 --dir apps/web run typecheck
npx --yes pnpm@12.10.1 --dir apps/web run test
npx --yes pnpm@12.10.1 --dir apps/web run build
npx --yes pnpm@12.10.1 --dir apps/web run test:e2e
```

API 검사는 Docker Desktop이 켜진 상태에서 실행합니다.

```powershell
cd apps/api
.\gradlew.bat spotlessCheck test build
```

웹 E2E는 Playwright Chromium 설치가 필요합니다. 처음 한 번 `npx --yes pnpm@12.10.1 --dir apps/web exec playwright install chromium`을 실행합니다. 실제 iPhone Safari의 핵심 흐름은 기능 구현 후 별도로 확인합니다.

웹 E2E는 프로덕션 빌드 결과를 실행하므로 `test:e2e` 전에 `build`를 실행합니다.

## 가입과 기존 로컬 기록 연결

1. Docker Compose로 PostgreSQL과 Mailpit을 실행합니다. 개발 확인 메일함은 `http://localhost:8025`입니다. 실제 Gmail 등으로 메일을 발송하지 않습니다.
2. 기존 admin 기록에 계정을 연결하려면 먼저 `.\scripts\connect-local-account.ps1`를 실행하고 연결할 이메일을 입력합니다. 주소는 숨김 입력으로 받고 서버 프로세스 메모리에서만 사용합니다. API가 재시작됩니다.
3. `http://localhost:3000/auth/register`에서 표시 이름·같은 이메일만 입력합니다. 메일의 숫자 8자리 인증번호를 원래 화면에 입력한 뒤 비밀번호·확인을 입력하고 `비밀번호 설정하고 가입 완료`를 누릅니다. 기존 거래·공간 ID가 그대로 유지됩니다. 첫 가입자가 자동으로 admin을 차지하지 않습니다.
4. 다른 이메일로 가입하면 별도 사용자이며, 로그인 후 첫 개인 공간을 만듭니다. 이미 이메일 확인을 마친 계정을 admin에 자동 연결하지 않습니다. 비밀번호 재설정도 로그인 화면에서 시작해 메일의 인증번호를 원래 화면에 입력합니다.

연결 이메일은 서버 재시작 시 환경에서 다시 지정해야 합니다. 연결 완료 후에는 DB의 로그인 자격 증명으로 유지되므로 재지정할 필요가 없습니다. `.\scripts\api-dev.ps1`와 복구 검사는 인증이 필요 없는 `/api/auth/health`로 준비 상태를 확인합니다.

인증번호는 10분·일회용이며 5회 틀리면 새 번호를 요청해야 합니다. 재발급하면 이전 번호와 미사용 설정 권한은 폐기됩니다. 가입 요청에서는 비밀번호를 정할 수 없고 번호 확인 뒤에만 설정합니다. Pwned Passwords에는 비밀번호의 SHA-1 앞 5자리만 전달합니다. 유출 조회 장애 시 설정 권한을 소모하지 않아 재시도할 수 있습니다. 테스트에서만 `app.auth.check-breaches=false`로 외부 조회를 대체합니다.

아이폰에서는 메일의 번호만 확인하고 홈 화면의 한달살림으로 돌아와 같은 화면에서 인증을 마칩니다. 진행 중인 요청은 원래 탭의 sessionStorage에 요청 ID·이메일 초안·단계만 임시 보관하며 번호·비밀번호·설정 권한은 저장하지 않습니다. 번호 입력 중 새로고침은 이어갈 수 있고, 비밀번호 단계에서 새로고침하면 새 번호를 요청합니다. 로그인 화면에도 진행 중인 인증으로 돌아가는 링크를 제공합니다. 이미 발송된 구버전 링크는 원래 만료까지 수용하지만 새 메일에는 링크를 보내지 않습니다. 실제 휴대폰 사용에는 접속 가능한 HTTPS 배포 주소가 필요하며 localhost는 해당 휴대폰 자신을 가리킵니다.

운영 환경에는 `APP_PUBLIC_URL`(HTTPS), `AUTH_MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, 필요시 `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_AUTH`, `SMTP_STARTTLS`를 서버 환경 변수로 설정합니다. 운영에서는 Secure 쿠키 기본값을 유지하고 로컬 계정 연결 환경 변수는 사용하지 않습니다. 초대 수락·소셜 로그인·이메일 변경·탈퇴는 후속 범위입니다.

## 실제 Gmail 인증 메일 발송

배포 전·도메인이 없는 현재 환경에서는 무료 Gmail SMTP로 실제 발송을 확인합니다. Gmail 2단계 인증과 앱 비밀번호를 준비한 뒤 아래 도구를 실행합니다. 비밀번호를 채팅·파일·명령 인수로 전달하지 마세요.

```powershell
.\scripts\configure-smtp.ps1 -Provider Gmail -SendTestMail
```

주소·앱 비밀번호는 숨김 입력하며, TLS 로그인과 본인 주소로의 테스트 발송이 성공한 뒤 API에 적용합니다. 메일 서버가 수락했는지와 실제 받은편지함에 도착했는지는 각각 확인합니다. Windows에서는 주소와 키를 함께 DPAPI로 암호화해 `%LOCALAPPDATA%/HandalSallim/credentials` 아래 프로젝트별로 저장합니다. 같은 Windows 계정·PC에서 API를 시작·재시작할 때 자동 복원하므로 PC 재부팅 후에도 다시 입력하지 않습니다. 저장 폴더는 현재 사용자와 SYSTEM만 접근하도록 제한하며 저장소·로그·명령 인수에는 비밀값을 남기지 않습니다.

주소·키 변경은 `.\scripts\configure-smtp.ps1 -Provider Gmail -UpdateCredentials`로 진행합니다. `-CheckOnly`는 저장·서버 적용 없이 연결만 검사합니다. 일반 API 재시작은 기존 실제 SMTP를 Mailpit으로 자동 전환하지 않습니다. Mailpit으로 돌아가려면 `.\scripts\api-dev.ps1 -Action Restart -UseMailpit`을 명시합니다. 이 옵션은 저장된 SMTP 값을 읽지 않으며 삭제하지도 않습니다. 저장·복원 검증은 `pwsh -NoProfile -File scripts/test-smtp-credentials.ps1`로 실제 키 없이 실행합니다.

운영 배포는 `prod` 프로필과 호스팅의 비밀 환경 변수로 구성하며 HTTPS·TLS·Secure 쿠키를 검증합니다. 상세 설정과 Brevo 전환 절차는 [인증 메일 발송 설정](docs/02-design/transactional-email.md)에 있습니다.

## 신규 사용자 가입 흐름의 실제 통합 검사

PowerShell 7과 Docker Desktop에서 아래를 실행합니다. 기존 개발 DB·Gmail API 프로세스는 사용하거나 재시작하지 않습니다.

```powershell
.\scripts\test-auth-flow.ps1
# 소스 빌드를 이미 마친 경우
.\scripts\test-auth-flow.ps1 -SkipBuild
```

임시 PostgreSQL·Mailpit과 별도 포트의 API·웹 서버로 실제 Chromium 검사 5개를 실행합니다. 가입 → SMTP에서 번호 확인 → 원래 화면에서 인증·비밀번호 설정 → 로그인 → 첫 공간 생성, 사용자 간 데이터 격리, 재가입 비밀번호 주입 거부, SMTP 중단·복구, 번호 재발급·재사용 거부, 원래 화면에서 재설정과 기존 세션 무효화를 확인합니다. 종료 시 이 실행이 만든 프로세스·컨테이너만 정리하고 실제 Gmail에는 발송하지 않습니다. 테스트에서는 유출 비밀번호 조회만 대체합니다.

회원코드 요청·수락·공유 공간 생성과 이전 기록의 본인 전용 보존도 통합 검사에 포함합니다. 운영 배포 환경의 검증과 별개이며, 이전 점검 상태와 갱신 내역은 [신규 사용자 흐름 배포 전 점검](docs/03-analysis/new-user-readiness.md)을 참고하세요.

## 회원코드로 함께 쓰기

설정 → 함께 쓰기에서 내 회원코드를 확인하고 상대 코드를 입력합니다. 상대 이름·코드를 확인해 요청을 보내고, 받은 사람이 수락하면 새 공유 가계부를 시작합니다. 요청은 24시간 유효하며 취소·거절할 수 있습니다. 자동 갱신과 알림은 없으며 화면의 새로고침 버튼으로 상태를 확인합니다.

연결 전 가계부는 본인만 읽을 수 있도록 보존하고, 이후 새 수입·지출·저축은 공동 가계부에 기록합니다. 이전 반복 고정비는 앞으로의 회차만 이어받으며 선납 완료한 회차는 다시 만들지 않습니다. 설정 → 함께 쓰기 → 보존된 이전 기록에서 이전 기록을 확인합니다. 자세한 정책과 검증은 [회원코드 공유 구현](docs/03-analysis/member-code-sharing.md)을 참고하세요.

연결 해제는 설정 → 함께 쓰기 → 연결 해제 요청에서 시작합니다. 상대가 새로고침으로 요청을 확인하고 `동의하고 연결 해제`를 눌러야 종료됩니다. 요청은 24시간 유효하며 취소·거절할 수 있습니다. 해제 후 공유 기록은 당시 두 멤버만 읽기 전용으로 보존하고, 각자의 새 개인 가계부를 만듭니다. 잔액·반복 고정비·사용자 설정은 자동 이월하지 않으며 다시 연결해도 새 공유 가계부로 시작합니다.
