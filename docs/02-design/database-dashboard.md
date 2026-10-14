# DB 기반 홈과 로컬 샘플

- 홈 API: `GET /api/dashboard`, 선택 쿼리 `month=YYYY-MM`. 기본 월과 지연 판정은 `Asia/Seoul` 날짜를 사용한다.
- 서버에서 활성 사용자·공간 멤버십을 확인하고 해당 공간의 활성 공동 지출만 반환한다. 개인·취소 거래와 취소 청구는 제외한다. 응답은 캐시하지 않는다.
- 홈, 등록 고정비, 개인 지출 화면은 각 API로 같은 로컬 PostgreSQL 데이터를 조회한다. 개인 지출 API는 작성자 본인만 조회하며 홈의 합계와 목록에 포함하지 않는다.
- 기존 데이터는 유지하고 `infra/seed-local-demo.sql`로 고정비 6개, 공동 일반 지출 4개, 개인 지출 5개를 로컬 admin 공간에 추가한다. 완료 고정비 2개에는 동일한 실제 금액의 공동 거래를 연결한다.
- 시드는 명시적으로 실행하며 운영 migration이나 서버 시작 시 자동 적용하지 않는다. 고정된 식별자와 트랜잭션으로 중복을 막고 재실행 시 기존 샘플 변경을 덮어쓰지 않는다. 날짜는 최초 실행 시 서울 기준 월로 설정한다.

프로젝트 루트 PowerShell에서, 기존 로컬 DB와 admin 공간이 준비된 뒤 실행한다.

```powershell
Get-Content -LiteralPath infra/seed-local-demo.sql -Raw |
  docker exec -i infra-postgres-1 psql -v ON_ERROR_STOP=1 -U handalsallim -d handalsallim
```

시드는 실제 금융 내역이 아닌 개발용 샘플이다. DB 비밀번호는 실행 환경에서 설정하며 코드·문서·로그에 기록하지 않는다.
