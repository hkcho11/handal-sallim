# Vercel 프론트 배포

한달살림의 Next.js만 Vercel에 배포한다. Spring Boot는 OCI, PostgreSQL은 Neon에서 운영한다. 프론트 배포 성공만으로 가입·로그인·저장이 준비된 것은 아니다.

## 프로젝트 설정

Vercel에서는 `scripts/vercel-pnpm.sh`로 임시 폴더에서 pnpm 12.10.1을 시작한 뒤 웹 폴더를 지정한다. 웹 폴더에서 바로 `npx`를 실행하면 Vercel의 최신 Node 24 패치 버전과 `devEngines.runtime`의 고정 버전을 npm이 먼저 비교하여 pnpm의 런타임 다운로드 전에 설치를 거부할 수 있다. 프로젝트의 고정 버전과 lockfile 검증은 유지한다.

| 항목 | 값 |
|---|---|
| Git 저장소 | `hkcho11/handal-sallim` |
| Framework | Next.js |
| Root Directory | `apps/web` |
| Node.js | `24.x` |
| Output Directory | Next.js 기본값 |

`apps/web/vercel.json`이 pnpm 12.10.1의 고정 설치와 빌드 명령을 지정한다. 로컬 변경은 먼저 GitHub 브랜치에 올린다. `main`에 병합되지 않은 변경은 `main` 배포에 포함되지 않는다. Vercel Hobby는 개인·비상업적 용도로만 사용한다.

## 연결 설정

- Vercel의 `API_ORIGIN`: 외부에서 접근 가능한 OCI API의 HTTPS 원점 주소. `/api` 경로를 붙이지 않는다. 서버 전용 환경 변수이며 `NEXT_PUBLIC_` 접두어를 붙이지 않는다.
- OCI의 `APP_PUBLIC_URL`: 확정한 Vercel 운영 HTTPS 원점 주소. 경로·쿼리·프래그먼트를 붙이지 않는다.
- DB와 SMTP 비밀번호는 Vercel에 넣지 않고 OCI 백엔드에만 설정한다.
- Vercel의 `localhost`나 `127.0.0.1`은 OCI가 아니다. 기본 개발용 주소로 운영 연결을 검증하지 않는다.
- 운영 환경에서는 `prod` 프로필과 Secure 쿠키를 유지한다. API에는 HTTPS를 적용하고 DB 포트를 인터넷에 개방하지 않는다.
- 인증 메일은 실제 Gmail 발신 주소를 유지하고 표시 이름 `handalsallim_admin`을 사용한다. `AUTH_MAIL_FROM`에는 표시 이름 없이 주소만 설정한다.

## 배포 확인

1. Vercel 빌드와 페이지 접속을 확인한다.
2. API HTTPS 연결과 메일 발송을 확인한다.
3. 가입 인증번호 입력, 로그인, 새로고침 이후 세션 유지를 확인한다.
4. 거래 저장과 재조회, 결제 완료 재시도의 중복 방지, 사용자 간 데이터 격리를 확인한다.
5. DB 백업과 복원 절차를 확보한 뒤 실제 사용을 시작한다.

Preview 배포를 운영 DB/API에 자동 연결하지 않는다. 별도 검증 환경이 없으면 운영 연결 정보는 Production 범위에만 지정한다.

## 관련 문서

- [Vercel 프로젝트 빌드 설정](https://vercel.com/docs/builds/configure-a-build)
- [Vercel 패키지 관리자](https://vercel.com/docs/package-managers)
- [인증 메일 설정](../02-design/transactional-email.md)
