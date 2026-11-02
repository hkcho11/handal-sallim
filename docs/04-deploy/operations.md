# 운영 배포와 점검

2026-11-02 기준 배포 구성이다. 비밀번호·토큰·개인키와 실제 개인 이메일 주소는 이 문서에 기록하지 않는다.

| 구성 | 운영 위치 |
|---|---|
| 프론트 | Vercel Hobby, https://handal-sallim.vercel.app |
| API | OCI Tokyo Always Free E2.1.Micro, Java 21 |
| DB | Neon Free PostgreSQL 18 |
| 인증 메일 | 기존 Gmail SMTP, 표시 이름 `handalsallim_admin` |

## 서버 구성

- `handalsallim-api.service`: `/opt/handalsallim/current.jar`를 전용 시스템 사용자로 실행한다. 재부팅 시 시작하고 비정상 종료 시 재시작한다.
- 운영 환경 변수: `/etc/handalsallim/api.env`. root만 읽을 수 있는 권한 600으로 관리하며 저장소에 복사하지 않는다.
- Caddy: `/etc/caddy/Caddyfile`. 공개 HTTPS 요청 중 `/api/*`만 내부 API로 전달하고 인증서를 자동 갱신한다.
- API는 `127.0.0.1:8081`에만 바인딩한다. 외부에는 웹 포트 80·443만 추가로 허용하고 SSH 22는 관리 PC IP로 제한한다. DB 포트는 공개하지 않는다.
- IP 기반 무료 DNS를 사용한다. OCI 공용 IP가 바뀌면 Caddy 호스트와 Vercel의 `API_ORIGIN`도 함께 바꿔야 한다.
- JVM 최대 힙은 384MB, DB 연결은 최대 3개이며 최소 유휴 연결은 0개다. 유휴 연결을 60초 뒤 정리하고 JDBC 세션 정리는 매시간 실행하여 미사용 DB가 절전할 수 있도록 한다. 무료 한도는 실제 사용량으로 확인한다.

## 상태 확인

```bash
sudo systemctl status handalsallim-api caddy --no-pager
curl --fail https://handal-sallim.vercel.app/backend/auth/health
```

응답은 `{"status":"UP"}`이다. 서버 시작 직후에는 Spring Boot 초기화와 DB 연결에 시간이 필요하다. 상태 확인에 성공한 뒤 가입·로그인을 확인한다.

```bash
sudo journalctl -u handalsallim-api --since "10 minutes ago" --no-pager
sudo systemctl restart handalsallim-api
```

서비스 재시작은 일시적인 접속 중단을 유발하므로 필요할 때만 수행한다.

## 확인한 범위

- Vercel 운영 배포 Ready와 실제 로그인 화면.
- Vercel → OCI API의 신뢰 가능한 HTTPS 연결.
- Neon 스키마 마이그레이션 V15까지 적용.
- 기존 Gmail SMTP의 인증서 검증·STARTTLS·로그인. 확인 과정에서 별도 테스트 메일은 발송하지 않았다.
- 운영 프록시를 통한 CSRF 발급, Secure 쿠키, 잘못된 로그인 401 및 비로그인 데이터 접근 401.
- 사용자의 실제 로그인 확인.

개별 실제 거래 등록·수정·삭제와 공유 가계부 흐름의 운영 검증, 별도 DB 백업·복원 검증은 후속 작업이다. 로컬·CI의 통합 검사 통과와 운영 데이터의 복원 검증을 같은 것으로 취급하지 않는다.
