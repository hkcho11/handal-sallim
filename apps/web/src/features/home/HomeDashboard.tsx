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
          <h1>한달살림</h1>
          <Link className={styles.add} href="/entries/new">
            + 내역 추가
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
            <RegisteredExpenses compact />
            <section className={styles.panel} aria-labelledby="methods-title">
              <h2 id="methods-title">결제수단별 금액</h2>
              <div className={styles.paymentTable}>
                <div className={styles.paymentHead}>
                  <span>결제수단</span>
                  <span>예상</span>
                  <span>확정</span>
                </div>
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
                      <span>{method ?? "미지정"}</span>
                      <strong>{won(confirmed + remaining)}</strong>
                      <strong>{won(confirmed)}</strong>
                    </div>
                  );
                })}
                {methods.length === 0 && (
                  <p className={styles.muted}>이번 달 결제 내역이 없습니다.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
