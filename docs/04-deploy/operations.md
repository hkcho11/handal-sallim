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

## 변경 종류별 배포

| 변경 | 현재 운영 반영 방식 |
|---|---|
| 프론트 | 검사 통과 후 main 병합 → Vercel 자동 빌드·배포 |
| 백엔드 | 검사 통과한 코드로 JAR 빌드 → OCI의 새 releases 파일로 업로드·해시 확인 → current.jar 전환 → handalsallim-api 재시작 → 상태·관련 기능 확인 |
| DB 구조 | 새 Flyway SQL 파일을 추가해 검증 → DB 백업·복원 방법 확인 → 해당 파일이 포함된 백엔드 배포 → 시작 시 미적용 migration 자동 실행 |

현재 GitHub Actions는 백엔드 검사·빌드를 수행하며 OCI 운영 배포는 자동화하지 않았다. main 병합만으로 운영 API와 Neon 스키마가 바뀌지는 않는다. Hibernate는 `validate`로 설정되어 있어 엔티티 수정만으로 테이블을 자동 변경하지 않는다.

이미 운영에 적용한 migration 파일은 수정하지 않고 다음 버전 파일을 추가한다. 앱 재시작 시 기존 migration은 다시 실행하지 않고 새 버전만 적용한다. 삭제·이름 변경·기존 값 변환 등 데이터에 영향을 주는 변경은 백업과 복원 검증 후 진행한다.

프론트와 API가 함께 바뀌면 기존 프론트와 호환되는 DB 추가 변경·백엔드를 먼저 배포하고 상태를 확인한 뒤 새 프론트를 배포한다. 컬럼 삭제 등 호환되지 않는 정리는 별도 후속 배포로 분리한다. main 병합 시 프론트 자동 배포가 시작되므로, API를 사용하는 새 프론트는 준비된 API보다 먼저 병합하지 않는다.

백엔드 장애 시 이전 JAR로 되돌릴 수 있지만 적용한 DB 변경이 자동으로 되돌아가지는 않는다. 이전 API와의 스키마 호환 여부를 확인하고, DB 복구는 별도 계획에 따라 수행한다. 현재 별도 백업·복원 검증은 아래 미확인 범위에 남아 있다.

## 상태 확인 명령

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
