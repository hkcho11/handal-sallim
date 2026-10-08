# 한달살림 MVP 인증·계정 복구 정책 초안

> 상태: Draft — 사용자 승인 전 구현 기준으로 사용하지 않음
>
> 기준: `SERVICE_PLAN.md` 0.7, `docs/01-plan/schema.md`
>
> 범위: 가입·로그인, 세션, 초대 수락 시 사용자 식별, 로그아웃, 계정 접근 복구

## 1. 이번에 결정할 내용

제품 데이터는 서버의 사용자·공간 멤버십을 기준으로 보호한다. 로그인 방법은 아직 승인되지 않았다. 아래 추천안은 혼자 개발하는 초기 웹 MVP의 가입·복구 운영 부담을 줄이기 위한 제안이다.

| 선택지 | 장점 | 주의할 점 |
|---|---|---|
| A. Google 로그인만 제공 (추천) | 앱 비밀번호·재설정 메일 운영이 불필요하고 Windows·iPhone 브라우저에서 같은 흐름을 쓸 수 있음 | Google 계정과 OAuth 설정에 의존하고, Google 계정에 접근하지 못하면 서비스도 이용할 수 없음 |
| B. 자체 이메일·비밀번호 | 외부 로그인 제공자에 덜 의존함 | 비밀번호 보관, 이메일 인증, 재설정 메일 발송·남용 방지까지 직접 운영해야 함 |
| C. 이메일 일회용 링크 | 앱 비밀번호 보관이 불필요함 | 메일 발송 서비스와 전달 지연·실패에 대한 복구 흐름이 필요함 |

추천 범위는 Google OpenID Connect의 기본 신원 범위(`openid`, `email`, `profile`)만 요청하는 것이다. 금융 데이터나 Google Drive 등의 권한은 요청하지 않는다. Google Cloud OAuth 동의 화면과 redirect URI를 설정해야 하며, 공개 운영 전에는 해당 시점의 Google 게시·브랜딩 요구사항을 다시 확인한다.

## 2. 추천 가입·로그인 흐름

1. 첫 방문자는 `Google로 계속하기`를 선택한다.
2. Spring Boot 서버가 OAuth2 Authorization Code/OIDC 로그인을 처리한다.
3. 서버가 ID 토큰의 발급자, 대상, 만료와 서명을 검증한 후 `(issuer, subject)`로 기존 `auth_identities`를 찾는다.
4. 연결된 식별자가 없으면 내부 `users`와 `auth_identities`를 원자적으로 생성한다. 이때 공간은 자동 생성하지 않는다.
5. 로그인 후 공간이 없으면 `공간 추가`, 공간이 있으면 홈으로 이동한다.

Google 이메일 주소는 표시·연락 용도로만 사용한다. 이메일이 같다는 이유만으로 기존 사용자 또는 다른 로그인 수단의 계정을 자동 연결하지 않는다. Google의 `sub`를 내부 사용자 ID로 그대로 사용하지 않고, 내부 UUID와 별도 매핑한다.

## 3. 세션과 권한 경계

- 브라우저는 서버 세션 쿠키로 로그인 상태를 유지한다. 인증 토큰과 세션 ID를 `localStorage` 또는 `sessionStorage`에 넣지 않는다.
- 운영 환경의 쿠키는 `Secure`, `HttpOnly`, `SameSite`와 HTTPS를 적용하고, 쿠키를 쓰는 변경 요청에는 CSRF 방어를 유지한다. 초대 링크로 외부 사이트에서 진입하는 흐름을 고려해 정확한 `SameSite` 값은 구현 검증으로 정한다.
- 로그인 성공 시 세션 ID를 갱신하고 로그아웃 시 서버 세션을 무효화한다. 민감한 응답은 공유 캐시에 저장하지 않는다.
- API는 세션에서 내부 사용자 ID를 확정한 다음 활성 공간 멤버십과 각 자원의 권한을 검사한다. 요청 본문의 사용자 ID나 공간 ID만으로 권한을 주지 않는다.
- 다른 멤버의 개인 거래는 목록·상세·합계 모두 서버에서 제외한다.
- 세션 지속 시간과 동시 로그인 기기 제한은 사용성 테스트 후 확정한다.

## 4. 초대 수락과 계정 복구

- 로그인 전 초대 링크를 열면 로그인 완료 후 같은 초대 확인 화면으로 돌아온다. URL의 초대 원문은 로그·분석 이벤트·브라우저 저장소에 기록하지 않는다.
- 초대 확인 화면은 초대한 사람과 공간을 보여준 뒤 수락을 별도 행동으로 받는다. 로그인만으로 자동 수락하지 않는다.
- 이미 다른 활성 공간에 속한 사용자, 만료·취소·사용된 초대에는 수락을 허용하지 않는다.
- Google 계정 접근을 잃은 경우 초기 MVP의 복구는 Google의 계정 복구 절차를 이용한다. 동일 이메일로 새 Google 계정을 만들어도 기존 한달살림 사용자와 자동 연결하지 않는다.
- 장기적으로 다른 로그인 수단 연결이 필요해지면, 기존 세션에서 재인증한 사용자만 연결할 수 있게 별도 정책을 승인한다. 관리자 임의 연결 절차는 이번 초안에 포함하지 않는다.

## 5. 데이터와 운영 영향

- `auth_identities`의 `(issuer, subject)` 유일성을 유지하고, 사용자 생성과 식별자 연결을 한 트랜잭션으로 처리한다.
- OAuth client secret과 세션 서명·암호화 비밀은 서버 환경에서만 관리한다. 코드, Git, 브라우저 번들, 로그에 넣지 않는다.
- 계정 탈퇴·데이터 삭제는 `SERVICE_PLAN.md`의 서버·로컬 데이터 정리 요구사항을 따른다. 공동 공간의 다른 멤버 데이터 보존과 소유권 이전은 별도 정책이 필요하므로 이 초안으로 삭제 동작을 확정하지 않는다.
- 초기에는 인증 제공자의 access/refresh token을 저장하지 않는 구성을 우선 검토한다. Google API 접근이 필요하지 않기 때문이다. 실제 Spring Security 구성에서 로그인 세션 유지에 필요한 값과 저장 범위는 구현 전에 확인한다.

## 6. 승인 후 검증할 시나리오

- 첫 로그인은 내부 사용자 하나를 만들고 공간은 만들지 않는다. 재로그인은 같은 사용자로 연결된다.
- 동일 이메일이라도 다른 `(issuer, subject)`는 자동으로 기존 사용자와 연결되지 않는다.
- 인증되지 않은 API 요청, 다른 공간 자원 요청, 다른 멤버의 개인 거래 요청을 차단한다.
- 외부 초대 링크 진입 → 로그인 → 초대 정보 확인 → 명시적 수락 순서가 유지된다.
- 로그아웃 후 이전 세션 쿠키로 API에 접근할 수 없다.
- CSRF 토큰이 없는 변경 요청은 거부되고, 정상적인 브라우저 흐름은 통과한다.
- Windows Chrome·Edge와 실제 iPhone Safari에서 로그인, 세션 유지, 로그아웃, 초대 복귀를 확인한다.

## 7. 승인 대기 결정

| ID | 결정 | 추천안 |
|---|---|---|
| AUTH-01 | MVP 로그인 수단 | Google 로그인만 제공 |
| AUTH-02 | 앱 자체 비밀번호·복구 메일 | MVP에서 운영하지 않음. Google 계정 복구를 이용 |
| AUTH-03 | 동일 이메일 계정 자동 연결 | 허용하지 않음. 식별자는 `(issuer, subject)` |
| AUTH-04 | 초대 링크 로그인 후 처리 | 초대 확인 화면으로 복귀하고 사용자가 직접 수락 |

세션 지속 시간, 동시 기기 제한, 공동 공간의 계정 탈퇴·삭제 정책은 이 네 결정 이후 별도로 확정한다.

## 8. 근거 자료

- [Spring Security OAuth 2.0 Login](https://docs.spring.io/spring-security/reference/servlet/oauth2/login/)
- [Spring Security CSRF 보호](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)
- [Google OpenID Connect: `sub` 식별자](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google OAuth 앱 게시·검증 개요](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
