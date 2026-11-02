# 로컬 SMTP 암호화 저장

2026-10-27 사용자 요청: Gmail 로그인 주소와 앱 비밀번호를 저장해 재입력하지 않는다. 이전의 메모리 전용 보관 결정을 이 요청으로 변경했다.

## 구현

- `scripts/smtp-credentials.ps1`: 주소·앱 비밀번호·발송 환경 설정 전체를 Windows DPAPI로 암호화한다. 사용자 지정 고정 키나 평문 자격 증명을 저장하지 않는다.
- 저장 위치는 Git 작업 폴더 밖 `%LOCALAPPDATA%/HandalSallim/credentials/<작업 경로 해시>/smtp.dpapi`이다. 폴더 ACL은 상속을 끊고 현재 사용자와 SYSTEM만 허용한다. 같은 Windows 계정·PC에서 자동 복원하며 다른 계정·PC로 파일만 옮겨 쓸 수 없다.
- `configure-smtp.ps1`은 SMTP 확인 성공 후 저장한다. 저장된 값은 다음 실행부터 자동 사용한다. `-UpdateCredentials`로 새 주소·키를 입력해 교체한다. `-CheckOnly`는 저장·서버 재시작 없이 연결만 확인한다.
- `api-dev.ps1`은 명시적 SMTP 환경 설정이 없으면 저장값을 읽는다. `-UseMailpit`은 저장값을 읽지 않고 명시적으로 Mailpit을 사용하며 파일을 삭제하지 않는다. 저장값 복호화 실패 시 기존 서버를 중단하기 전에 안내한다.
- 원자적 파일 교체로 저장 실패 시 이전 파일을 유지하며, 복원할 모든 항목을 확인한 뒤 환경에 적용한다. 호출 셸 환경은 입력 도구가 종료 시 복구한다. 상태 파일·로그·명령 인수에 주소·키를 기록하지 않는다.

## 검증

- 합성 자격 증명만 사용하는 `pwsh -NoProfile -File scripts/test-smtp-credentials.ps1` 통과: 평문 주소·키 미포함, 제한된 ACL, 새 PowerShell 프로세스 복원, 없는 저장소, 손상 파일 거부·환경 보존, 잘못된 저장 시 이전 파일 보존. 실제 저장 파일은 테스트에서 읽거나 변경하지 않는다.
- PowerShell 전체 스크립트 구문 검사 통과. `git diff --check` 통과.
- 실제 숨김 입력을 통해 암호화 파일 생성과 SMTP 연결 확인, API 적용 성공을 확인했다. 테스트 메일을 발송하지 않았다.
- SMTP 제공자·주소·비밀번호 환경 변수가 없는 새 셸에서 `pwsh -NoProfile -File scripts/api-dev.ps1 -Action Restart -SkipBuild`를 실행해 재입력 없이 API 준비 완료를 확인했다. 실제 Gmail 설정과 자동 감시 상태가 유지됐다.
- Java·웹 제품 코드는 변경하지 않았으므로 해당 단위·브라우저 검사는 이번 작업에서 반복하지 않았다. 실제 PC 재부팅·다른 Windows 계정/PC에서의 복호화 시도는 실행하지 않았다.
