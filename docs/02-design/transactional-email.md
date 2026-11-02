# 한달살림 인증 메일 발송 설정

기준일: 2026-10-27. 배포 전·보유 도메인 없음에 따라 Gmail SMTP로 실제 수신을 확인하고, 배포 시 전용 발송 서비스로 전환한다. 실제 발신 주소·키·앱 비밀번호는 문서나 Git 저장소에 기록하지 않는다. 사용자 요청에 따라 로컬 Windows 계정으로 암호화해 보관한다.

## 지금 연결하기

가입·비밀번호 재설정 메일에는 URL 대신 숫자 인증번호를 발송하며, 2026-11-02 변경에서 길이를 8자리에서 6자리로 줄인다. 유효시간은 10분이며 원래 한달살림 화면에 입력한다. SMTP 자격 증명·TLS 설정은 유지하며 상세 정책은 [인증 정책](auth-policy.md)을 따른다.

1. 발신용 Gmail 계정의 2단계 인증을 켜고 [Google 앱 비밀번호](https://myaccount.google.com/apppasswords)에서 전용 앱 비밀번호를 만든다. 일반 Google 비밀번호는 사용하지 않는다. 계정 정책에 따라 앱 비밀번호 기능이 제공되지 않을 수 있다.
2. 프로젝트 루트 PowerShell에서 실행한다.

```powershell
.\scripts\configure-smtp.ps1 -Provider Gmail -SendTestMail
```

3. Gmail 전체 주소와 16자리 앱 비밀번호를 숨김 입력한다. 주소는 발신자와 테스트 수신자로 사용되며 실제 수신자에게 발신 Gmail 주소가 표시된다. 복사한 앱 비밀번호의 공백은 제거한다.
4. 독립 SMTP 검사(`gradlew --no-daemon --quiet smtpCheck`)가 TLS·SMTP 로그인을 확인한다. `-SendTestMail`을 지정한 경우에만 본인 주소로 인증 토큰 없는 연결 확인 메일 1통을 보낸다. 서버 수락과 실제 받은편지함 도착은 서로 다르므로 받은편지함·스팸함을 직접 확인한다.
5. 검사 성공 후 API를 재빌드·재시작하고 `local,mail-smtp` 프로필을 적용한다. 연결 검사 실패 시 기존 실행 API는 중단하지 않는다. 이후 가입 확인·재설정 메일은 Mailpit 대신 실제 메일함으로 전송된다.

`-CheckOnly`를 추가하면 연결 검사만 수행하고 저장·API 재시작은 하지 않는다. 저장된 설정이 있으면 입력 없이 사용한다. `-UpdateCredentials`를 추가하면 기존 저장값을 읽지 않고 새 주소·키를 입력해 성공 시 교체한다. `-SendTestMail`이 없으면 어떤 메일도 보내지 않는다. 기존 계정은 재설정 메일 요청으로 실제 인증 메일 수신을 확인할 수 있으며 가입이나 기존 데이터 삭제는 필요 없다.

## 비밀값과 재시작

Windows DPAPI로 주소·앱 비밀번호와 발송 설정 전체를 암호화해 `%LOCALAPPDATA%/HandalSallim/credentials/<프로젝트 경로 해시>/smtp.dpapi`에 저장한다. 프로젝트 폴더 밖에 두며 현재 Windows 사용자와 SYSTEM에게만 폴더 접근을 허용한다. 암호화 키는 코드나 별도 파일로 저장하지 않고 Windows가 관리한다. 다른 PC·Windows 계정으로 파일만 복사해서 사용할 수 없다.

API 시작·재시작 시 명시적인 SMTP 환경 설정이 없으면 저장값을 자동 복원한다. PC 재부팅 후에도 같은 계정이면 재입력하지 않는다. 읽기 실패 시 서버를 멈추기 전에 안내하고 Mailpit으로 조용히 전환하지 않는다. 저장값 교체는 SMTP 연결 확인 성공 후에 수행하고 원자적 파일 교체로 이전 값을 보호한다. 입력 도구는 종료 시 호출 셸의 환경을 복구한다. `.local/smtp-setup-status.json`에는 상태·제공자·검사 시각만, `.local/api/state.json`에는 실행 프로세스와 제공자 이름만 기록한다.

Mailpit을 명시적으로 쓰려면 아래를 실행한다. 이 실행은 저장값 복원을 건너뛰며 암호화 파일 자체는 삭제하지 않는다.

```powershell
.\scripts\api-dev.ps1 -Action Restart -UseMailpit
```

운영 서버에는 호스팅의 비밀 환경 변수 저장소를 사용한다. 이 로컬 입력 도구를 운영용 비밀 저장소로 사용하지 않는다. Google 비밀번호 변경·앱 비밀번호 폐기 시 SMTP 연결 정보도 갱신한다. 앱 비밀번호는 Google 계정 접근 자격이므로 Google에서 한달살림 전용으로 발급·폐기한다.

## 보안 설정과 프로필

- `mail-smtp`: SMTP AUTH, STARTTLS 필수, 인증서 호스트 확인, 디버그 로그 비활성화, 연결·읽기·쓰기 제한 시간 적용. 암호화 미지원 서버로 평문 로그인하지 않는다.
- `local,mail-smtp`: 개발용 `http://localhost:3000` 또는 `http://127.0.0.1:3000` 링크를 허용한다. 다른 기기로 보낸 localhost 링크는 그 기기에서 이 PC에 연결되지 않으므로 외부 테스트에는 실제 사이트 주소가 필요하다.
- `prod`: 프로필 그룹으로 `mail-smtp`를 활성화한다. HTTPS 서비스 주소와 Secure 세션 쿠키를 강제하고 `local`과 동시 활성화를 거부한다. 로컬 admin 연결은 운영에서 사용하지 않는다.
- Gmail은 SMTP 로그인 주소와 발신 주소를 일치시킨다. 발신자·링크 주소에 요청 값을 사용하지 않는다.
- 가입·비밀번호 재설정 메일의 표시 이름은 `handalsallim_admin`이다. `AUTH_MAIL_FROM`에는 표시 이름 없이 실제 SMTP 로그인 이메일만 넣는다. 수신자는 표시 이름과 실제 발신 주소를 모두 확인할 수 있다.
- 무료 개인 Gmail은 발송량 제한과 계정 정책의 영향을 받는다. 일반 사용자의 가입·복구가 늘어나기 전에 서비스 전용 발송 계정·도메인으로 전환한다. 마케팅·대량 발송용으로 사용하지 않는다.

## 배포 시 전환

보유 도메인과 HTTPS 운영 주소를 준비한 뒤 전용 SMTP 서비스로 변경한다. Brevo 무료 플랜은 현재 하루 300통과 transactional SMTP를 포함한다. 발신 도메인은 Brevo 화면에 표시되는 소유 확인·DKIM·DMARC 레코드로 인증하고, 기존 DNS의 SPF·DMARC 정책을 임의로 덮어쓰지 않는다. Gmail 주소 자체는 소유 도메인 인증 대상으로 사용할 수 없다.

| 서버 환경 변수 | Gmail 사전 검증 | Brevo 배포 시 |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | 도구에서 `local,mail-smtp` | `prod` |
| `SMTP_HOST` | `smtp.gmail.com` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` | `587` |
| `SMTP_USER` | 발신 Gmail 전체 주소 | Brevo SMTP 화면의 로그인 값 |
| `SMTP_PASSWORD` | Google 앱 비밀번호 | Brevo SMTP 키 (API 키와 다름) |
| `AUTH_MAIL_FROM` | SMTP 로그인과 같은 주소 | 인증한 도메인의 발신 주소 |
| `APP_PUBLIC_URL` | `http://localhost:3000` | 실제 HTTPS 서비스 원점 주소 |

발송 서비스 전환은 도메인 확인과 실제 받은편지함 확인까지 완료해야 끝난다. SMTP 서버의 수락만으로 스팸함 분류나 최종 도착을 보장하지 않는다. 공급자 발송 제한·반송·차단 상태를 확인하고 무료 한도를 넘기기 위해 유료 요금제를 자동 선택하지 않는다.

## 근거

- [Google SMTP 설정](https://support.google.com/mail/answer/7104828?hl=ko)
- [Google 앱 비밀번호](https://support.google.com/accounts/answer/185833?hl=ko)
- [개인 Gmail 발송 제한](https://support.google.com/mail/answer/22839?hl=ko)
- [Brevo 무료 플랜](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)
- [Brevo SMTP 연결](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP)
- [Brevo 도메인 인증](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC)
- [Angus Mail의 TLS 설정](https://eclipse-ee4j.github.io/angus-mail/docs/api/org.eclipse.angus.mail/org/eclipse/angus/mail/smtp/package-summary.html)
