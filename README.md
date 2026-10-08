# 한달살림

반복 생활비를 관리하는 반응형 웹 서비스입니다. 현재 저장소는 웹, API와 로컬 PostgreSQL의 개발 기반만 포함합니다. 제품 요구사항은 [SERVICE_PLAN.md](SERVICE_PLAN.md)를 따릅니다.

## 구성

- `apps/web`: Next.js App Router, React, TypeScript 웹
- `apps/api`: Spring Boot API, JPA, Flyway
- `infra/compose.yaml`: 로컬 PostgreSQL 18
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
npx --yes pnpm@12.10.1 --dir apps/web run dev
```

API는 다른 PowerShell에서 같은 `DB_PASSWORD` 값을 설정하고 실행합니다.

```powershell
cd apps/api
.\gradlew.bat bootRun
```

웹은 `http://localhost:3000`, API는 `http://localhost:8080`에서 실행됩니다. 현재 API에는 제품 엔드포인트가 없습니다. PostgreSQL 중지 시 `docker compose -f infra/compose.yaml down`을 사용하면 데이터 볼륨은 유지됩니다.

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
