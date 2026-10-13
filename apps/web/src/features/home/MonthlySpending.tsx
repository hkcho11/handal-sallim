import {
  calculateSpendingStatistics,
  MOCK_SPENDING_ENTRIES,
} from "./spendingStatistics";
import styles from "./home-dashboard.module.css";

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
        <h2 id="spending-title" className={styles.sectionTitle}>
          이번 달 지출 요약
        </h2>
        <div className={styles.statGrid}>
          <article className={`${styles.panel} ${styles.summary}`}>
            <h3>실제 지출</h3>
            <p className={styles.statAmount}>{won(statistics.spent)}</p>
            <p className={styles.summaryNote}>결제 완료된 고정비 + 일반 지출</p>
          </article>
          <article className={styles.panel}>
            <h3>남은 고정비 예정액</h3>
            <p className={styles.statAmount}>{won(remaining)}</p>
            <p className={styles.summaryNote}>지연 항목을 포함한 미결제 금액</p>
          </article>
          <article className={styles.panel}>
            <h3>월말 예상 지출</h3>
            <p className={styles.statAmount}>{won(statistics.projected)}</p>
            <p className={styles.summaryNote}>실제 지출 + 남은 고정비 예정액</p>
          </article>
        </div>
        <p className={styles.summaryNote}>
          예시 데이터 · 공동 생활비와 내 개인 지출 합계입니다. 월말 예상에는
          앞으로의 일반 지출이 포함되지 않습니다.
        </p>
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
