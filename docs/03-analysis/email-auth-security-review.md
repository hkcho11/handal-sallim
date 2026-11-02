# 이메일 인증 보안 점검

점검일: 2026-10-28 (Asia/Seoul). 현재 로컬 작업 트리 기준. 제품 인증 동작과 설정은 변경하지 않았다.

후속 변경: 사용자 요청에 따라 이메일 링크에서 비밀번호를 설정하는 방식으로 변경했다. 아래 최초 점검의 인증 전 재가입 P1은 [후속 구현·검증](email-first-signup.md)을 참고한다. 최초 점검 내용과 다른 미해결 사항은 그대로 보존한다.

## 판정과 범위

기본 인증 방어는 구현되어 있으나, 신규 가입 확인 흐름과 프록시 뒤 요청 제한은 공개 배포 전에 보완해야 한다. 보안 무결함이나 침해 이력 부재를 보장하는 검사는 아니다. 기존 인증 완료 계정의 비밀번호를 공개 재가입 API로 덮어쓰는 문제는 확인되지 않았다.

코드: auth API/application/persistence, 웹 인증 화면·클라이언트·백엔드 프록시, 설정·migration, 관련 테스트. 실제 사용자 DB와 Gmail을 이용한 공격·발송은 하지 않았다. Testcontainers의 별도 PostgreSQL과 모의 메일 발송을 사용했다. 로컬 웹 로그인 화면과 API health는 읽기 요청으로만 헤더를 확인했다.

## 발견 사항

### P1: 인증 전 재가입이 비밀번호를 바꾸고, 이메일 확인은 그 비밀번호를 아는지 검증하지 않음

- 근거: `AuthService.register()`의 `replacePending()` 호출, `complete()`의 이메일 확인 분기. `AccountRepository.replacePending()`은 비밀번호와 표시 이름을 교체한다.
- 재현: 피해자 주소로 가입 → 같은 주소로 공격자가 정한 비밀번호로 재가입 → 이전 링크 거부 → 이메일 소유자가 최신 링크를 확인 → 공격자가 정한 비밀번호로 로그인 성공, 최초 비밀번호는 실패.
- 이메일 소유자가 공격자의 가입 시도에서 발급된 최신 메일을 확인해야 한다는 조건이 있다. 이미 인증된 계정의 비밀번호는 이 경로로 바뀌지 않는다. 기존 데이터에 무조건 접근 가능하다는 의미가 아니다.
- 개선: 이메일 소유권 확인 뒤 본인이 비밀번호를 설정하도록 순서를 바꾸거나, 해당 가입 시도에 연결된 비밀번호를 확인하는 절차를 둔다. 인증 전 계정 비밀번호를 단순 고정하는 것만으로는 선점 가입 문제를 해결하지 못한다.
- 격리 재현 테스트 1건에서 이 동작을 확인했다.

### P1: 프록시 뒤 사용자가 IP별 요청 제한을 공유함

- 근거: `AuthController`는 `request.getRemoteAddr()`를 사용한다. 웹의 `backendProxy.ts`는 별도 서버에서 API를 호출한다. 신뢰할 프록시·실제 클라이언트 주소를 확정하는 설정이 현재 소스에 없다.
- 기본 구성에서 API가 보는 주소는 웹 서버 주소이므로, 사용자들이 같은 제한 버킷을 공유한다. 인증/재설정 완료 요청은 합쳐 15분당 30회, 각 가입·로그인·메일 요청의 IP 버킷은 300회다. 이메일별 제한도 별도로 있다.
- 격리 테스트: 같은 transport peer에서 서로 다른 X-Forwarded-For를 담은 잘못된 링크 확인 요청 30회 후, 다른 전달 주소의 31번째 요청도 429였다. 실제 운영 프록시 환경을 부하 공격한 결과가 아니라 현재 서버 제한 기준을 재현한 것이다.
- 개선: 배포 진입점에서 원본 전달 헤더를 제거하고 신뢰할 주소를 설정하며, API 직접 접근을 막고 신뢰할 프록시만 인정한다. 임의의 X-Forwarded-For를 그대로 신뢰하는 수정은 제한 우회를 만든다. 서로 다른 실제 사용자와 조작된 전달 헤더로 통합 검증 필요.

### P2: 비밀번호 해시 비용과 신규 비밀번호 강도 보완

- `AuthConfiguration.java:41`의 PBKDF2 v5.8 기본값은 SHA-256, 310,000회다. OWASP의 PBKDF2-HMAC-SHA256 현재 권장은 600,000회 이상이다. 평문 저장 문제는 아니며 DB 유출 시 오프라인 추측 비용을 더 높이는 개선이다.
- 변경 시 해시 식별자를 새로 부여하고 기존 인코더를 유지해야 한다. 현재 식별자의 반복 횟수만 바꾸면 기존 계정 로그인이 깨질 수 있다. 로그인 성공 시 점진적 재해시 등을 설계한다.
- 최소 8자·문자+숫자 규칙은 기존 승인 정책이다. 이메일 가입 확인은 로그인 MFA가 아니며, MFA 없는 비밀번호에 대한 OWASP 권고 최소 15자보다 낮다. 신규 가입·재설정 정책 변경은 사용자 확인 후 진행하고 기존 계정을 즉시 차단하지 않는다.
- 출처: [Spring PBKDF2 API](https://docs.spring.io/spring-security/reference/7.0/api/java/org/springframework/security/crypto/password/Pbkdf2PasswordEncoder.html), [OWASP 저장 지침](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP 인증 지침](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

### P2: 웹 문서 보안 헤더와 운영 환경 확인 필요

- 로컬 `/auth/login` HTTP 200 응답에서 CSP, X-Frame-Options, X-Content-Type-Options가 없었다. API `/api/auth/health`에는 DENY와 nosniff가 있었다. API 응답의 헤더가 웹 문서를 자동 보호하지는 않는다.
- 웹 문서에 frame-ancestors 또는 X-Frame-Options와 nosniff를 적용하고, Next.js 실행 방식에 맞는 CSP를 검증한다. 이번 검사에서 실제 XSS 공격을 발견했다는 의미는 아니다.
- HSTS는 HTTP 로컬 응답에 없는 것만으로 결함 판정하지 않았다. 운영 HTTPS·HSTS·실제 Secure 쿠키·신뢰할 프록시·API/DB 비공개 접근은 배포 환경에서 확인해야 한다.

## 웹 운영 의존성 검사

`pnpm audit --prod --json`은 Next.js 16.3.8에 critical 2건, high 1건을 보고했다. 패키지 버전 경고와 현재 앱의 공격 가능성을 구분한다.

| 공지 | 현재 영향 검토 |
|---|---|
| [이미지 최적화 RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) | glibc Linux의 관련 이미지 처리 조건. 설치·lockfile의 sharp는 0.35.5로 공지의 우회 조치인 0.35.5 이상을 충족한다. 현재 로컬은 Windows. 실제 운영 Linux 악용 재현은 하지 않음. |
| [Server Actions DoS](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) | 최소 하나의 Server Action 사용 조건. 현재 src에서 use server는 발견하지 못했다. |
| [use cache RCE](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) | Cache Components와 여러 typed array를 반환하는 use cache 함수 조건. 현재 설정과 소스에서 해당 사용을 발견하지 못했다. |

공지의 Next.js 수정 버전은 16.4.1이다. 현재 즉시 원격 코드 실행 가능하다고 판정하지는 않지만, 배포 전 수정 버전으로 올리고 빌드·사용자 흐름을 재검증하는 것을 권한다. 이번 요청에서는 버전을 변경하지 않았다. Java 전이 의존성에 대한 별도 SCA는 실행하지 않았다.

## 확인된 기본 방어

- salt를 사용하는 PBKDF2 단방향 비밀번호 저장. 비밀번호 원문을 응답하지 않음.
- 이메일 확인 전 로그인 및 미인증 업무 API 접근 거부.
- 32바이트 무작위 인증 링크, 서버에는 SHA-256 해시 저장. 이메일 확인 24시간, 재설정 30분 만료. 재발급 시 기존 링크 폐기 및 단일 사용·동시 소비 방어.
- 링크 토큰은 URL fragment에 담고 웹에서 읽은 뒤 주소에서 제거. GET만으로 이메일 확인을 완료하지 않음.
- 로그인 성공 시 이전 세션 무효화, HttpOnly/SameSite=Lax, 운영 Secure 쿠키. 미사용 7일·절대 30일 서버 만료.
- 비밀번호 재설정 후 기존 모든 세션의 credential version 불일치로 접근 거부.
- 변경 API의 CSRF 쿠키·헤더 검증. SQL 파라미터 바인딩.
- 운영 SMTP의 STARTTLS 필수·서버 인증서 호스트 확인·민감한 메일 디버깅 차단과 고정 인증 링크 도메인 검증.
- 로그인 실패·가입·복구의 기본 응답은 일반화되어 있음. 다만 동기 SMTP 발송 여부에 따른 시간 차이로 계정 존재 추측 가능성이 남아 있으며, 시간 기반 열거에 대한 통계적 실측은 하지 않았다.

## 실행한 검증

- `gradlew.bat test --tests 'com.handalsallim.auth.*' --rerun-tasks`: 통과. 최종 기존 인증군 재실행 19건, 실패·오류·skip 0.
- 신규 임시 재현 검사 2건: 위 P1 동작을 모두 재현. 정상 방어가 통과했다는 의미가 아니다. 소스와 XML을 Git 제외 `.local/auth-security-review`에 보존하고 일반 테스트 소스에서 제거했다.
- `vitest run src/features/auth/api.test.ts src/shared/api/backendProxy.test.ts`: 11건 통과.
- `pnpm audit --prod --json`, `pnpm list next sharp react react-dom --depth 3`: 위 결과 확인. audit은 취약점 경고가 있으며 통과 판정하지 않음.
- 로컬 로그인 문서·API health 읽기 요청 및 응답 보안 헤더 확인.
- 이번에는 전체 브라우저 통합, 실제 Gmail 발송, 실제 iPhone Safari, 운영 HTTPS 및 인프라, 전체 서비스 침투 검사, Java SCA는 실행하지 않았다. 코드 수정이 없어 전체 포맷·빌드는 재실행하지 않았다.

## 권장 순서

1. 인증 전 가입 비밀번호 확정 흐름과 프록시 기반 요청 제한을 먼저 보완.
2. Next.js 보안 수정 버전 반영과 웹 보안 헤더 적용.
3. 기존 비밀번호 호환성을 유지하며 해시 비용 강화. 최소 길이 변경 여부 확정.
4. 실제 배포 주소에서 HTTPS·쿠키·프록시와 가입부터 재설정까지 전체 흐름 검증.
