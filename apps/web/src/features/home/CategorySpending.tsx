import type { CSSProperties } from "react";
import {
  calculateSpendingStatistics,
  type SpendingEntry,
} from "./spendingStatistics";
import styles from "./home-dashboard.module.css";

const colors = [
  "#315beb",
  "#899bfa",
  "#f0b65e",
  "#55acb4",
  "#b79ad3",
  "#bdc5d4",
];
const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

export default function CategorySpending({
  entries,
  month,
}: {
  entries: SpendingEntry[];
  month: string;
}) {
  const { categories, spent } = calculateSpendingStatistics(entries, 0, month);
  const largest = categories[0];
  return (
    <section className={styles.panel} aria-labelledby="category-title">
      <div className={styles.sectionHeader}>
        <h2 id="category-title">카테고리별 지출</h2>
        <span className={styles.sectionMeta}>실제 지출 기준</span>
      </div>
      {largest ? (
        <>
          <div className={styles.categoryOverview}>
            <div className={styles.donut}>
              <svg
                viewBox="0 0 120 120"
                role="img"
                aria-label={`카테고리별 비중: ${categories.map((category) => `${category.name} ${category.share.toFixed(1)}%`).join(", ")}`}
              >
                {categories.map((category, index) => {
                  const preceding = categories
                    .slice(0, index)
                    .reduce((sum, item) => sum + item.share, 0);
                  return (
                    <circle
                      key={category.name}
                      cx="60"
                      cy="60"
                      r="48"
                      fill="none"
                      stroke={colors[index % colors.length]}
                      strokeWidth="13"
                      pathLength="100"
                      strokeDasharray={`${category.share} ${100 - category.share}`}
                      strokeDashoffset={-preceding}
                      transform="rotate(-90 60 60)"
                    />
                  );
                })}
              </svg>
              <div className={styles.donutCenter}>
                <span>지출 분류</span>
                <strong>
                  {categories.length}
                  <small>개</small>
                </strong>
              </div>
            </div>
            <div className={styles.categoryInsight}>
              <span>가장 많이 쓴 곳</span>
              <strong>
                {largest.name} <b>{largest.share.toFixed(1)}%</b>
              </strong>
              <p>{won(largest.amount)}</p>
            </div>
          </div>
          <div className={styles.categoryList}>
            {categories.map((category, index) => (
              <details key={category.name} className={styles.category}>
                <summary>
                  <span className={styles.categoryName}>
                    <i
                      style={
                        {
                          "--category-color": colors[index % colors.length],
                        } as CSSProperties
                      }
                      aria-hidden="true"
                    />
                    <strong>{category.name}</strong>
                  </span>
                  <span className={styles.categoryValue}>
                    <b>{won(category.amount)}</b>
                    <small>{category.share.toFixed(1)}%</small>
                  </span>
                  <span className={styles.categoryArrow} aria-hidden="true">
                    ⌄
                  </span>
                </summary>
                <ul className={styles.categoryEntries}>
                  {[...category.items]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((entry) => (
                      <li key={entry.id}>
                        <span>
                          {entry.name}
                          <small>
                            {Number(entry.date.slice(5, 7))}.
                            {Number(entry.date.slice(8))} ·{" "}
                            {entry.paymentMethod ?? "결제수단 미지정"}
                          </small>
                        </span>
                        <strong>{won(entry.amount)}</strong>
                      </li>
                    ))}
                </ul>
              </details>
            ))}
          </div>
          <div className={styles.categoryTotal}>
            <span>합계</span>
            <strong>{won(spent)}</strong>
          </div>
        </>
      ) : (
        <div className={styles.emptyBreakdown}>
          <strong>아직 지출이 없어요</strong>
          <p>함께 쓴 내역이 생기면 여기에 모아드릴게요.</p>
        </div>
      )}
    </section>
  );
}
