"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listFixedExpenses, type FixedExpense } from "../fixed-expenses/api";
import styles from "./home-dashboard.module.css";

const STATUS_LABELS = { PENDING: "예정", OVERDUE: "지연", COMPLETED: "완료" };

export default function RegisteredExpenses({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    listFixedExpenses()
      .then((items) => {
        if (active) setExpenses(items);
      })
      .catch(() => {
        if (active) setHasError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function handleRetry() {
    setIsLoading(true);
    setHasError(false);
    setAttempt((value) => value + 1);
  }

  return (
    <section
      className={styles.panel}
      aria-labelledby="registered-title"
      aria-busy={isLoading}
    >
      <div className={styles.sectionHeader}>
        <h2 id="registered-title">등록한 고정비</h2>
        <Link href="/fixed-costs">고정비 관리 →</Link>
      </div>
      {isLoading ? (
        <p role="status" className={styles.muted}>
          등록한 고정비를 불러오는 중입니다.
        </p>
      ) : hasError ? (
        <div role="alert" className={styles.loadError}>
          <p>등록한 고정비를 불러오지 못했습니다.</p>
          <button type="button" onClick={handleRetry}>
            다시 불러오기
          </button>
        </div>
      ) : expenses.length === 0 ? (
        <p className={styles.muted}>
          {compact
            ? "고정비를 추가해 보세요."
            : "등록한 고정비가 없습니다. 내역 추가에서 등록해 보세요."}
        </p>
      ) : (
        <>
          <p className={styles.muted}>
            {compact
              ? `${expenses.length}건 · `
              : `실제 등록 내역 ${expenses.length}건 · 등록 금액 합계 `}
            {expenses
              .reduce((sum, expense) => sum + expense.expectedAmount, 0)
              .toLocaleString("ko-KR")}
            원
          </p>
          <ul className={styles.timeline}>
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className={compact ? styles.registeredRow : styles.charge}
              >
                {!compact && (
                  <div className={styles.date}>
                    <span>등록</span>
                    <strong>내역</strong>
                  </div>
                )}
                <div className={styles.chargeInfo}>
                  <div className={styles.chargeTitle}>
                    <h3>{expense.name}</h3>
                    <span
                      className={`${styles.badge} ${expense.firstChargeStatus === "OVERDUE" ? styles.overdue : expense.firstChargeStatus === "COMPLETED" ? styles.completed : styles.pending}`}
                    >
                      {expense.firstChargeStatus
                        ? STATUS_LABELS[expense.firstChargeStatus]
                        : "일정 미정"}
                    </span>
                  </div>
                  {!compact && (
                    <>
                      <p>첫 결제일 {expense.firstDueDate ?? "미정"}</p>
                      <p>
                        담당자{" "}
                        {expense.payer === "ME"
                          ? "나"
                          : expense.payer === "PARTNER"
                            ? "함께 관리하는 사람"
                            : "미지정"}{" "}
                        · {expense.paymentMethodName ?? "결제수단 미지정"}
                      </p>
                    </>
                  )}
                </div>
                <div className={styles.amount}>
                  <strong>
                    {expense.expectedAmount.toLocaleString("ko-KR")}원
                  </strong>
                  {!compact && <span>등록 금액</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
