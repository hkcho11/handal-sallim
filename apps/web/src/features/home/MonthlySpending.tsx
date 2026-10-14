"use client";

import { useRef, useState } from "react";
import {
  calculateSpendingStatistics,
  type SpendingEntry,
} from "./spendingStatistics";
import { summarizeCharges, type DashboardCharge } from "./dashboard";
import styles from "./home-dashboard.module.css";
import SpendingBreakdown from "./SpendingBreakdown";
import CategorySpending from "./CategorySpending";

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
      <section
        className={styles.summarySection}
        aria-labelledby="spending-title"
      >
        <div className={styles.sectionHeader}>
          <h2 id="spending-title" className={styles.sectionTitle}>
            이번 달 지출 요약
          </h2>
        </div>
        <div className={styles.statGrid}>
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
        <div className={styles.spendingProgress}>
          <div className={styles.progressTrack} aria-hidden="true">
            <span
              style={{
                width: `${statistics.projected ? (statistics.spent / statistics.projected) * 100 : 0}%`,
              }}
            />
          </div>
          <div className={styles.progressLegend}>
            <span>
              <i />
              지출 완료{" "}
              {statistics.projected
                ? Math.round((statistics.spent / statistics.projected) * 100)
                : 0}
              %
            </span>
            <span>
              남은 결제{" "}
              {charges.filter((charge) => charge.status !== "완료").length}건
            </span>
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
              key={selected}
              view={selected}
              entries={entries}
              charges={charges}
              month={month}
              onClose={handleClose}
            />
          )}
        </div>
      </section>
      <CategorySpending entries={entries} month={month} />
    </>
  );
}
