"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { getFixedCostDashboard } from "./fixedCostApi";
import type { FixedCostDashboard } from "./fixedCostStatistics";
import FixedCostInsights from "./FixedCostInsights";
import styles from "./fixed-cost-dashboard.module.css";
import { useHomeViewState } from "./HomeViewState";
import { SERVICE_UNAVAILABLE_MESSAGE } from "../../shared/api/serviceAvailability";

export default function HomeDashboard() {
  const [month, setMonth] = useHomeViewState<string | undefined>(
    "month",
    undefined,
  );
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>
            <Image
              src="/brand/handal-sallim-blue.png"
              alt=""
              width={48}
              height={48}
              className={styles.brandMark}
              priority
            />
            한달살림
          </h1>
          <span className={styles.dashboardLabel}>고정비 대시보드</span>
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
      .catch((error: unknown) => {
        if (active)
          setError(
            error instanceof Error &&
              error.message === SERVICE_UNAVAILABLE_MESSAGE
              ? SERVICE_UNAVAILABLE_MESSAGE
              : "고정비 통계를 불러오지 못했습니다.",
          );
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
          <div className={styles.monthActions}>
            <button
              type="button"
              className={styles.today}
              onClick={() => {
                setData(null);
                setAttempt((value) => value + 1);
              }}
            >
              <span aria-hidden="true">↻</span>
              <span className={styles.srOnly}>통계 새로고침</span>
            </button>
            <button
              type="button"
              className={styles.today}
              disabled={data.month === data.asOf.slice(0, 7)}
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
      </section>
      <FixedCostInsights data={data} />
    </>
  );
}
