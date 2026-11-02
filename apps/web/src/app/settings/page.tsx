import Link from "@/shared/ui/AppLink";
import styles from "@/features/settings/settings.module.css";
export default function Page() {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1>설정</h1>
      </header>
      <h2>계정</h2>
      <Link className={styles.row} href="/auth/account">
        <span>
          <strong>내 계정</strong>
          <small>로그인 계정 확인 및 로그아웃</small>
        </span>
        <span aria-hidden="true">›</span>
      </Link>
      <Link className={styles.row} href="/settings/sharing">
        <span>
          <strong>함께 쓰기</strong>
          <small>회원코드·연결 요청·공유 가계부</small>
        </span>
        <span aria-hidden="true">›</span>
      </Link>
      <h2>내역 관리</h2>
      <Link className={styles.row} href="/payment-methods">
        <span>
          <strong>결제수단 관리</strong>
          <small>카드·계좌·현금 등록과 보관</small>
        </span>
        <span aria-hidden="true">›</span>
      </Link>
      <Link className={styles.row} href="/settings/categories">
        <span>
          <strong>분류 설정</strong>
          <small>상위 분류·세부 분류 추가와 확인</small>
        </span>
        <span aria-hidden="true">›</span>
      </Link>
      <h2>서비스 안내</h2>
      <Link className={styles.row} href="/settings/guide">
        <span>
          <strong>사용 및 데이터 안내</strong>
          <small>결제수단 보관·일정 기준</small>
        </span>
        <span aria-hidden="true">›</span>
      </Link>
      <p>한달살림 · 반복 생활비 관리</p>
    </main>
  );
}
