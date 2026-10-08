<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 한달살림 웹 개발 명령

루트 디렉터리에서 `npx --yes pnpm@12.10.1 --dir apps/web`을 접두어로 사용한다. 이 방식은 로컬 시스템의 pnpm 버전과 관계없이 고정된 pnpm 12.10.1 및 프로젝트 Node.js 24.21.0을 사용한다.

- 설치: `npx --yes pnpm@12.10.1 --dir apps/web install --frozen-lockfile`
- 개발 서버: `npx --yes pnpm@12.10.1 --dir apps/web run dev`
- 포맷 확인: `npx --yes pnpm@12.10.1 --dir apps/web run format:check`
- 린트: `npx --yes pnpm@12.10.1 --dir apps/web run lint`
- 타입 검사: `npx --yes pnpm@12.10.1 --dir apps/web run typecheck`
- 단위·컴포넌트 테스트: `npx --yes pnpm@12.10.1 --dir apps/web run test`
- 빌드: `npx --yes pnpm@12.10.1 --dir apps/web run build`
- 브라우저 테스트: `npx --yes pnpm@12.10.1 --dir apps/web run test:e2e`

`src/app`은 라우팅과 화면 조합, `src/features`는 기능별 UI와 규칙, `src/shared`는 공용 API·UI·순수 함수를 둔다. 기능이 생길 때 필요한 폴더만 만든다. 서버 응답은 API 경계에서 검증하고 화면에서 DB나 인증 저장소를 직접 호출하지 않는다. `next-env.d.ts`, `.next`, `node_modules`, Playwright 보고서는 생성물로 취급해 직접 수정하지 않는다.

CI는 포맷, 린트, 타입 검사, Vitest, 빌드, Playwright Chromium 흐름을 검사한다. 로컬 기본 검증은 Windows Chrome·Edge이며, 실제 iPhone Safari 교차 확인은 기능 흐름이 생긴 뒤 수행한다. 360px와 1280px 폭, 키보드 탐색, 200% 확대를 기능 화면의 수용 검사에 포함한다.
