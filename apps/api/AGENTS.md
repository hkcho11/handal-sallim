# 한달살림 API 개발 지침

Java 21, Spring Boot 4.1.1, Gradle Wrapper 9.7.1, PostgreSQL 18.6을 사용한다. 전역 Gradle 설치에 의존하지 않는다.

Windows PowerShell에서 `apps/api` 디렉터리 기준으로 실행한다.

- 개발 서버: `.\gradlew.bat bootRun` (`DB_PASSWORD` 환경 변수와 로컬 PostgreSQL 필요)
- Java 포맷 적용: `.\gradlew.bat spotlessApply`
- Java 포맷 확인: `.\gradlew.bat spotlessCheck`
- 테스트와 빌드: `.\gradlew.bat test build` (Testcontainers가 Docker Desktop을 사용)

`src/main/java/com/handalsallim` 아래에 기능별 패키지를 둔다. 기능 안의 의존 방향은 `api → application → domain`이며, JPA entity와 저장소 adapter는 `persistence`에 둔다. 도메인은 Spring MVC·JPA에 의존하지 않는다. 데이터 스키마는 `src/main/resources/db/migration`의 Flyway migration으로 관리하고 Hibernate는 `validate`만 사용한다. Gradle Wrapper JAR과 migration은 검토 대상이며 `build`와 `.gradle`은 생성물이다.

CI는 Spotless 검사, JUnit·Testcontainers 테스트, 빌드를 실행한다. 외부 입력과 현재 사용자·공간 권한을 서버 경계에서 검증하고 raw server error, secret, token과 거래 메모를 로그에 남기지 않는다.
