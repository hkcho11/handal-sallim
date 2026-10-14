"use client";

import { useState, useSyncExternalStore } from "react";
import styles from "./personal-expenses.module.css";

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

const subscribeToMonth = () => () => {};
const serverMonth = () => null;

export default function PersonalExpensesScreen() {
  const month = useSyncExternalStore(
    subscribeToMonth,
    currentMonth,
    serverMonth,
  );
  const [monthOffset, setMonthOffset] = useState(0);
  const [year, monthNumber] = month ? month.split("-").map(Number) : [];
  const selectedDate = month
    ? new Date(Date.UTC(year, monthNumber - 1 + monthOffset, 1))
    : null;
  const monthLabel = selectedDate
    ? `${selectedDate.getUTCFullYear()}년 ${selectedDate.getUTCMonth() + 1}월`
    : "월 선택";

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>나의 생활비</p>
            <h1>개인 지출</h1>
          </div>
          <span className={styles.badge}>화면 미리보기</span>
        </header>

        <p className={styles.intro}>
          개인으로 사용한 금액과 내역을 월별로 확인하는 공간이에요.
        </p>

        <section
          className={styles.panel}
          aria-labelledby="personal-summary-title"
        >
          <div className={styles.monthNavigation}>
            <button
              type="button"
              aria-label="이전 달"
              disabled={!month}
              onClick={() => setMonthOffset((current) => current - 1)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <h2
              id="personal-summary-title"
              aria-live="polite"
              aria-atomic="true"
            >
              {monthLabel}
            </h2>
            <button
              type="button"
              aria-label="다음 달"
              disabled={!month}
              onClick={() => setMonthOffset((current) => current + 1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
          <button
            type="button"
            className={styles.today}
            disabled={!month}
            onClick={() => setMonthOffset(0)}
          >
            이번 달
          </button>
          <div className={styles.summary}>
            <span>월간 개인 지출</span>
            <strong aria-label="합계 집계 준비 중">—</strong>
            <p>내역을 연결하면 이달의 개인 지출 합계를 보여드려요.</p>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="personal-list-title">
          <div className={styles.sectionHeading}>
            <h2 id="personal-list-title">지출 내역</h2>
            <button
              type="button"
              className={styles.addButton}
              disabled
              aria-describedby="personal-preview-note"
            >
              + 지출 추가
            </button>
          </div>
          <div className={styles.emptyState}>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <rect x="11" y="7" width="26" height="34" rx="4" />
              <path d="M18 17h12M18 24h12M18 31h7" />
            </svg>
            <h3>개인 지출 기록을 준비하고 있어요</h3>
            <p id="personal-preview-note">
              지금은 화면 구성 단계예요. 지출 등록과 내역 조회는 다음 단계에서
              연결됩니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
