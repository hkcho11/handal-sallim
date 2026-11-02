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
| 백엔드 | main의 전체 CI 통과 → GitHub의 공개 `backend-nightly` 사전 릴리스에 환경 비밀값 없는 JAR·검증 메타데이터 게시 → 오전 4시 OCI가 가져와 검사·백업·교체·재시작·상태 확인 |
| DB 구조 | 새 Flyway SQL 파일 추가 → CI 검증 → 오전 4시 배포 전 백업 → 새 백엔드 시작 시 미적용 migration 자동 실행. 위험 구문이 있으면 자동 배포를 멈추고 수동 검토 |

main 병합 후 프론트는 바로 배포되고, 백엔드는 다음 한국 시간 오전 4시에 변경이 있을 때만 배포된다. OCI가 공개 릴리스에서 직접 가져오므로 GitHub에 SSH 개인키·DB 비밀번호를 등록하지 않으며 기존 SSH IP 제한도 유지한다. 공개 저장소·공개 빌드만 대상으로 한다. 저장소를 비공개로 바꾸면 이 다운로드 방식을 재설계해야 한다. Hibernate는 `validate`로 설정되어 있어 엔티티 수정만으로 테이블을 자동 변경하지 않는다.

## 새벽 자동 배포

- 예약: `handalsallim-deploy.timer`, `04:00 Asia/Seoul`. 서버가 꺼져 놓친 예약을 낮에 따라 실행하지 않는다. 실행 스크립트도 오전 4시대 이외의 실제 배포를 거부한다.
- API 코드 트리 해시가 같으면 재시작하지 않는다. 프론트만 바뀐 경우에도 API가 유지된다. 초기 기준은 설치 당시 실제 운영 JAR과 같은 API 소스 트리로 지정한다.
- CI 성공한 main 후보만 허용한다. JAR 해시, 기존 migration 불변 여부, 새 migration의 보수적인 위험 구문 검사를 통과해야 한다. 이 검사는 SQL의 모든 부작용을 판정하는 분석기가 아니므로 코드 리뷰를 대체하지 않는다.
- 새 후보가 검증되면 PostgreSQL 18 `pg_dump`로 DB를 먼저 백업한다. 백업 실패·1GiB 미만 여유 공간이면 기존 API를 건드리지 않는다. 복원 도구도 같은 주요 버전을 사용한다.
- 백업: `/var/backups/handalsallim/*.dump`, root 전용 600, 디렉터리 700. 자동 삭제·만료는 설정하지 않았다. 같은 OCI 디스크에 있으므로 별도 외부 재해 복구 사본은 아니며 디스크 사용량을 점검해야 한다.
- 새 API는 최대 3분 동안 정상 응답을 확인한다. DB 변경이 없는 배포 실패는 이전 JAR로 복원한다. DB 변경이 포함됐으면 스키마가 바뀌었을 수 있어 자동으로 DB나 API를 되돌리지 않고 서비스를 정지해 수동 복구를 요구한다.
- 백업·확인 단계는 실행 중인 API를 유지한다. 실제 JAR 교체·재시작 동안 약 1분의 중단을 예상한다. 첫 설치 때는 운영 API 재시작 없이 기준 버전과 예약만 설정한다.
- 배포 도구 자체는 루트 소유로 별도 설치하며 다운로드한 JAR이 이를 교체하지 않는다. 도구를 수정하면 검증 후 서버의 도구도 갱신해야 한다.

```bash
systemctl list-timers handalsallim-deploy.timer --no-pager
sudo journalctl -u handalsallim-deploy --since "1 day ago" --no-pager
sudo python3 /opt/handalsallim/nightly_api.py --dry-run
sudo systemctl disable --now handalsallim-deploy.timer
```

마지막 명령은 예약을 중지한다. 실제 재시작을 동반하는 배포 리허설은 새벽에 확인하며, 낮에는 dry-run과 격리된 임시 DB 복원 검사만 수행한다. 자동 배포 실패 알림 발송은 별도로 설정하지 않았으므로 배포 예정일에는 위 로그와 사이트 상태를 확인한다.

이미 운영에 적용한 migration 파일은 수정하지 않고 다음 버전 파일을 추가한다. 앱 재시작 시 기존 migration은 다시 실행하지 않고 새 버전만 적용한다. 삭제·이름 변경·기존 값 변환 등 데이터에 영향을 주는 변경은 백업과 복원 검증 후 진행한다.

프론트와 API가 함께 바뀌면 기존 프론트와 호환되는 DB 추가 변경·백엔드를 먼저 배포하고 상태를 확인한 뒤 새 프론트를 배포한다. 컬럼 삭제 등 호환되지 않는 정리는 별도 후속 배포로 분리한다. main 병합 시 프론트 자동 배포가 시작되므로, API를 사용하는 새 프론트는 준비된 API보다 먼저 병합하지 않는다.

백엔드 장애 시 이전 JAR로 되돌릴 수 있지만 적용한 DB 변경이 자동으로 되돌아가지는 않는다. 이전 API와의 스키마 호환 여부를 확인하고, DB 복구는 별도 계획에 따라 수행한다.

## 상태 확인 명령

### 화면 이동의 재조회 줄이기

홈·수입·지출·저축 목록은 인증된 계정 범위의 브라우저 메모리에서 10초간만 재사용한다. 월별 조회는 월을 별도 키로 구분하며, 동시에 발생한 같은 조회도 합친다. 브라우저 저장소나 서버 공용 캐시에는 금융 데이터를 보관하지 않는다.

쓰기 요청 시작·완료, 계정 변경, 인증·권한 오류, 앱 복귀 때 보관한 조회를 비운다. 명시적 새로고침·재시도는 서버를 다시 조회한다. 다른 사용자가 변경한 데이터는 재방문 시 최대 10초 동안 이전 결과가 보일 수 있고, 현재 화면의 실시간 자동 갱신은 제공하지 않는다.

홈의 예정 청구 생성 경로는 같은 트랜잭션에서 이미 잠근 공간을 재사용한다. 회원·공간 권한 검증과 중복 생성 방지는 유지하며, 기존 8개 SQL 호출 중 중복 조회 2개를 없앤다(세션·인증·트랜잭션 처리는 별도). 인증 세션 응답도 해당 요청에서 확인한 계정 이름을 재사용한다. DB 구조 변경은 없으며 기존 API와 호환되어 프론트 먼저 배포하고 API는 오전 4시 예약으로 반영할 수 있다.

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
- 2026-11-02: 운영 DB의 root 전용 custom-format 백업·아카이브 검사, 네트워크가 차단된 임시 PostgreSQL 18 컨테이너에 실제 복원 성공. 운영 DB는 수정하지 않았고 검사 컨테이너는 제거했다.

개별 실제 거래 등록·수정·삭제와 공유 가계부 흐름의 운영 검증, 외부 재해 복구 사본·새벽 실제 재시작 리허설은 후속 작업이다. 로컬·CI의 통합 검사 통과와 운영 데이터의 복원 검증을 같은 것으로 취급하지 않는다.

## Vercel 봇 댓글 메일 줄이기

Vercel 프로젝트 Settings → Git → Connected Git Repository에서 Pull Request Comments와 Commit Comments를 끄면 봇이 새 댓글을 남기지 않는다. 프리뷰 배포와 CI 검사는 유지할 수 있다. 이는 GitHub 전체 알림이나 Actions 실패 메일을 끄는 설정과 다르다. `vercel.json`의 예전 `github.silent` 대신 대시보드 설정을 사용한다.

공식 안내: https://vercel.com/docs/git/vercel-for-github#silence-github-comments
