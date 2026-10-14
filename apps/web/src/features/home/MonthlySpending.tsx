"use client";

import { useState } from "react";
import {
  calculateSpendingStatistics,
  MOCK_SPENDING_ENTRIES,
} from "./spendingStatistics";
import styles from "./home-dashboard.module.css";
import SpendingBreakdown from "./SpendingBreakdown";

const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

export default function MonthlySpending({ remaining }: { remaining: number }) {
  const [selected, setSelected] = useState<"actual" | "remaining" | null>(null);

  function handleSelect(view: "actual" | "remaining") {
    setSelected((current) => (current === view ? null : view));
  }
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
        <div className={`${styles.panel} ${styles.statGrid}`}>
          <button
            type="button"
            className={styles.statItem}
            aria-expanded={selected === "actual"}
            aria-controls="spending-breakdown"
            onClick={() => handleSelect("actual")}
          >
            <span className={styles.statLabel}>실제 지출</span>
            <strong className={styles.statAmount}>
              {won(statistics.spent)}
            </strong>
          </button>
          <button
            type="button"
            className={styles.statItem}
            aria-expanded={selected === "remaining"}
            aria-controls="spending-breakdown"
            onClick={() => handleSelect("remaining")}
          >
            <span className={styles.statLabel}>남은 지출</span>
            <strong className={styles.statAmount}>{won(remaining)}</strong>
          </button>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>월 예상 지출</span>
            <strong className={styles.statAmount}>
              {won(statistics.projected)}
            </strong>
          </div>
        </div>
        <div id="spending-breakdown" hidden={selected === null}>
          {selected && <SpendingBreakdown view={selected} />}
        </div>
      </section>
      <section className={styles.panel} aria-labelledby="category-title">
        <div className={styles.sectionHeader}>
          <h2 id="category-title">카테고리별 지출</h2>
          <span className={styles.badge}>예시 · 공동 + 내 개인</span>
        </div>
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
