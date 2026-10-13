import {
  calculateSpendingStatistics,
  MOCK_SPENDING_ENTRIES,
} from "./spendingStatistics";
import styles from "./home-dashboard.module.css";
import Link from "next/link";

const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

export default function MonthlySpending({ remaining }: { remaining: number }) {
  const statistics = calculateSpendingStatistics(
    MOCK_SPENDING_ENTRIES,
    remaining,
    "2026-10",
  );
  return (
    <>
      <section aria-labelledby="spending-title">
        <div className={styles.sectionHeader}>
          <h2 id="spending-title" className={styles.sectionTitle}>
            이번 달 지출 요약
          </h2>
          <span className={styles.badge}>예시 데이터</span>
        </div>
        <div className={styles.statGrid}>
          <Link
            href="/spending/actual"
            className={`${styles.panel} ${styles.summary} ${styles.statCard}`}
          >
            <h3>실제 지출</h3>
            <p className={styles.statAmount}>{won(statistics.spent)}</p>
            <span className={styles.statAction}>내역 보기 ›</span>
          </Link>
          <Link
            href="/spending/remaining"
            className={`${styles.panel} ${styles.statCard}`}
          >
            <h3>남은 예정 지출</h3>
            <p className={styles.statAmount}>{won(remaining)}</p>
            <span className={styles.statAction}>내역 보기 ›</span>
          </Link>
          <Link
            href="/spending/projected"
            className={`${styles.panel} ${styles.statCard}`}
          >
            <h3>월말 예상 지출</h3>
            <p className={styles.statAmount}>{won(statistics.projected)}</p>
            <span className={styles.statAction}>내역 보기 ›</span>
          </Link>
        </div>
      </section>
      <section className={styles.panel} aria-labelledby="category-title">
        <div className={styles.sectionHeader}>
          <h2 id="category-title">카테고리별 지출</h2>
          <span className={styles.badge}>예시 · 공동 + 내 개인</span>
        </div>
        <p className={styles.muted}>
          실제 지출 기준 · 카테고리를 누르면 내역을 볼 수 있습니다.
        </p>
        <div className={styles.categoryList}>
          {statistics.categories.map((category) => (
            <details key={category.name} className={styles.category}>
              <summary>
                <span className={styles.categoryHeading}>
                  <strong>{category.name}</strong>
                  <span>
                    {won(category.amount)} · {category.share.toFixed(1)}%
                  </span>
                </span>
                <span className={styles.barTrack} aria-hidden="true">
                  <span
                    className={styles.barFill}
                    style={{ width: `${category.share}%` }}
                  />
                </span>
              </summary>
              <ul className={styles.categoryEntries}>
                {category.items.map((entry) => (
                  <li key={entry.id}>
                    <span>
                      {entry.name}
                      <small>
                        {entry.date} · {entry.scope}
                      </small>
                    </span>
                    <strong>{won(entry.amount)}</strong>
                  </li>
                ))}
              </ul>
              {category.items.length === 0 && (
                <p className={styles.muted}>이번 달 지출이 없습니다.</p>
              )}
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
