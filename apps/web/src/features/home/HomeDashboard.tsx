"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboard } from "./api";
import { type DashboardResponse } from "./dashboard";
import styles from "./home-dashboard.module.css";
import RegisteredExpenses from "./RegisteredExpenses";
import MonthlySpending from "./MonthlySpending";
const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;
export default function HomeDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [paymentView, setPaymentView] = useState<"actual" | "expected">(
    "actual",
  );
  useEffect(() => {
    let active = true;
    getDashboard()
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError("생활비를 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const methods = data
    ? [
        ...new Set([
          ...data.entries.map((entry) => entry.paymentMethod ?? null),
          ...data.charges
            .filter((charge) => charge.status !== "완료")
            .map((charge) => charge.paymentMethod),
        ]),
      ]
    : [];
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
        {error ? (
          <div role="alert" className={styles.loadError}>
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
        ) : !data ? (
          <p role="status">생활비를 불러오는 중…</p>
        ) : (
          <>
            <div className={styles.month}>
              <p className={styles.scope}>함께 쓰는 생활비</p>
              <h2>
                {data.month.slice(0, 4)}년 {Number(data.month.slice(5))}월
              </h2>
              <span>
                {Number(data.asOf.slice(5, 7))}월 {Number(data.asOf.slice(8))}일
                기준
              </span>
            </div>
            <MonthlySpending
              entries={data.entries}
              charges={data.charges}
              month={data.month}
            />
            <section className={styles.panel} aria-labelledby="methods-title">
              <div className={styles.sectionHeader}>
                <h2 id="methods-title">결제수단별 금액</h2>
                <div
                  className={styles.segmented}
                  role="group"
                  aria-label="결제수단 금액 기준"
                >
                  <button
                    type="button"
                    aria-pressed={paymentView === "actual"}
                    onClick={() => setPaymentView("actual")}
                  >
                    실제
                  </button>
                  <button
                    type="button"
                    aria-pressed={paymentView === "expected"}
                    onClick={() => setPaymentView("expected")}
                  >
                    예상
                  </button>
                </div>
              </div>
              <div className={styles.paymentTable}>
                {methods.map((method) => {
                  const confirmed = data.entries
                    .filter((entry) => (entry.paymentMethod ?? null) === method)
                    .reduce((sum, entry) => sum + entry.amount, 0);
                  const remaining = data.charges
                    .filter(
                      (charge) =>
                        charge.status !== "완료" &&
                        charge.paymentMethod === method,
                    )
                    .reduce((sum, charge) => sum + charge.expectedAmount, 0);
                  return (
                    <div
                      key={method ?? "unassigned"}
                      className={styles.paymentRow}
                    >
                      <span className={styles.paymentName}>
                        <span className={styles.paymentIcon} aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <rect x="3" y="5" width="18" height="14" rx="3" />
                            <path d="M3 10h18M7 15h3" />
                          </svg>
                        </span>
                        {method ?? "미지정"}
                      </span>
                      <strong>
                        {won(
                          paymentView === "actual"
                            ? confirmed
                            : confirmed + remaining,
                        )}
                      </strong>
                    </div>
                  );
                })}
                {methods.length === 0 && (
                  <p className={styles.muted}>이번 달 결제 내역이 없습니다.</p>
                )}
              </div>
            </section>
            <RegisteredExpenses compact />
          </>
        )}
      </div>
    </main>
  );
}
