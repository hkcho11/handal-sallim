"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getFixedCostDashboard } from "./fixedCostApi";
import type { FixedCostDashboard } from "./fixedCostStatistics";
import FixedCostInsights from "./FixedCostInsights";
import styles from "./fixed-cost-dashboard.module.css";

export default function HomeDashboard() {
  const [month, setMonth] = useState<string>();
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>
            <span className={styles.brandMark} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 10 12 4l7 6v9H5zM9 19v-7h6v7" />
              </svg>
            </span>
            한달살림
          </h1>
          <Link className={styles.add} href="/entries/new">
            + 고정비 추가
          </Link>
        </header>
        <MonthDashboard
          key={month ?? "current"}
          selectedMonth={month}
          onMonth={setMonth}
        />
      </div>
    </main>
  );
}
function MonthDashboard({
  selectedMonth,
  onMonth,
}: {
  selectedMonth?: string;
  onMonth: (month: string | undefined) => void;
}) {
  const [data, setData] = useState<FixedCostDashboard | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getFixedCostDashboard(selectedMonth)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError("고정비 통계를 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, [selectedMonth, attempt]);
  function shiftMonth(offset: number) {
    if (!data) return;
    const target = new Date(`${data.month}-01T00:00:00Z`);
    target.setUTCMonth(target.getUTCMonth() + offset);
    onMonth(target.toISOString().slice(0, 7));
  }
  if (error)
    return (
      <div role="alert" className={styles.error}>
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            setError("");
            setData(null);
            setAttempt((value) => value + 1);
          }}
        >
          다시 불러오기
        </button>
      </div>
    );
  if (!data)
    return (
      <p role="status" className={styles.loading}>
        고정비 통계를 불러오는 중…
      </p>
    );
  return (
    <>
      <section className={styles.monthSection} aria-label="통계 조회 월">
        <div className={styles.monthHeading}>
          <span>고정비 통계</span>
          <div className={styles.monthActions}>
            <button
              type="button"
              className={styles.today}
              onClick={() => {
                setData(null);
                setAttempt((value) => value + 1);
              }}
            >
              통계 새로고침
            </button>
            <button
              type="button"
              className={styles.today}
              onClick={() => onMonth(undefined)}
            >
              이번 달
            </button>
          </div>
        </div>
        <div className={styles.monthPicker}>
          <button
            type="button"
            aria-label="이전 달"
            disabled={data.month === "0002-01"}
            onClick={() => shiftMonth(-1)}
          >
            ‹
          </button>
          <label className={styles.monthInput}>
            <span className={styles.srOnly}>조회 월</span>
            <input
              type="month"
              aria-label="조회 월"
              min="0002-01"
              max="9998-12"
              value={data.month}
              onChange={(event) => {
                if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value))
                  onMonth(event.target.value);
              }}
            />
          </label>
          <button
            type="button"
            aria-label="다음 달"
            disabled={data.month === "9998-12"}
            onClick={() => shiftMonth(1)}
          >
            ›
          </button>
        </div>
        <p className={styles.asOf}>
          {Number(data.asOf.slice(5, 7))}월 {Number(data.asOf.slice(8))}일 기준
          · 예정 결제월로 집계
        </p>
      </section>
      <FixedCostInsights data={data} />
    </>
  );
}
