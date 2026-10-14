"use client";

import { useRef, useState } from "react";
import {
  calculateSpendingStatistics,
  type SpendingEntry,
} from "./spendingStatistics";
import { summarizeCharges, type DashboardCharge } from "./dashboard";
import styles from "./home-dashboard.module.css";
import SpendingBreakdown from "./SpendingBreakdown";

const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

export default function MonthlySpending({
  entries,
  charges,
  month,
}: {
  entries: SpendingEntry[];
  charges: DashboardCharge[];
  month: string;
}) {
  const remaining = summarizeCharges(charges).remaining;
  const [selected, setSelected] = useState<"actual" | "remaining" | null>(null);
  const actualButton = useRef<HTMLButtonElement>(null);
  const remainingButton = useRef<HTMLButtonElement>(null);

  function handleClose() {
    const button =
      selected === "actual" ? actualButton.current : remainingButton.current;
    setSelected(null);
    button?.focus();
  }

  function handleSelect(view: "actual" | "remaining") {
    setSelected((current) => (current === view ? null : view));
  }
  const statistics = calculateSpendingStatistics(entries, remaining, month);
  return (
    <>
      <section aria-labelledby="spending-title">
        <div className={styles.sectionHeader}>
          <h2 id="spending-title" className={styles.sectionTitle}>
            이번 달 지출 요약
          </h2>
        </div>
        <div className={`${styles.panel} ${styles.statGrid}`}>
          <button
            ref={actualButton}
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
            <span className={styles.statHint}>
              내역 보기
              <svg
                viewBox="0 0 16 16"
                className={styles.statChevron}
                aria-hidden="true"
              >
                <path d="m4 6 4 4 4-4" />
              </svg>
            </span>
          </button>
          <button
            ref={remainingButton}
            type="button"
            className={styles.statItem}
            aria-expanded={selected === "remaining"}
            aria-controls="spending-breakdown"
            onClick={() => handleSelect("remaining")}
          >
            <span className={styles.statLabel}>남은 지출</span>
            <strong className={styles.statAmount}>{won(remaining)}</strong>
            <span className={styles.statHint}>
              내역 보기
              <svg
                viewBox="0 0 16 16"
                className={styles.statChevron}
                aria-hidden="true"
              >
                <path d="m4 6 4 4 4-4" />
              </svg>
            </span>
          </button>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>월 예상 지출</span>
            <strong className={styles.statAmount}>
              {won(statistics.projected)}
            </strong>
          </div>
        </div>
        <div
          id="spending-breakdown"
          hidden={selected === null}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              handleClose();
            }
          }}
        >
          {selected && (
            <SpendingBreakdown
              view={selected}
              entries={entries}
              charges={charges}
              month={month}
              onClose={handleClose}
            />
          )}
        </div>
      </section>
      <section className={styles.panel} aria-labelledby="category-title">
        <div className={styles.sectionHeader}>
          <h2 id="category-title">카테고리별 지출</h2>
        </div>
        <div className={styles.categoryList}>
          {statistics.categories.length === 0 && (
            <p className={styles.muted}>이번 달 공동 지출이 없습니다.</p>
          )}
          {statistics.categories.map((category) => (
            <details key={category.name} className={styles.category}>
              <summary>
                <span className={styles.categoryHeading}>
                  <strong>{category.name}</strong>
                  <span className={styles.categoryValue}>
                    <b>{won(category.amount)}</b>
                    <small>{category.share.toFixed(1)}%</small>
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
