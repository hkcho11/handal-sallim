"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  errorMessage,
  listPersonalExpenses,
  type PersonalExpenseMonth,
} from "./api";
import styles from "./personal-expenses.module.css";

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

const subscribeToMonth = () => () => {};
const serverMonth = () => null;

export default function PersonalExpensesScreen({
  initialMonth,
}: {
  initialMonth?: string;
}) {
  const todayMonth = useSyncExternalStore(
    subscribeToMonth,
    currentMonth,
    serverMonth,
  );
  const [chosenMonth, setChosenMonth] = useState(initialMonth);
  const month = chosenMonth ?? todayMonth;
  const [monthOffset, setMonthOffset] = useState(0);
  const selectedDate = month ? new Date(`${month}-01T00:00:00Z`) : null;
  if (selectedDate)
    selectedDate.setUTCMonth(selectedDate.getUTCMonth() + monthOffset);
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
          <Link className={styles.addButton} href="/personal-expenses/new">
            + 지출 추가
          </Link>
        </header>

        <p className={styles.intro}>
          본인이 작성한 개인 지출만 확인할 수 있어요.
        </p>

        <section className={styles.panel} aria-label="조회 월 선택">
          <div className={styles.monthNavigation}>
            <button
              type="button"
              aria-label="이전 달"
              disabled={!month || monthLabel === "1년 1월"}
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
              disabled={!month || monthLabel === "9999년 12월"}
              onClick={() => setMonthOffset((current) => current + 1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
          <button
            type="button"
            className={styles.today}
            disabled={!month}
            onClick={() => {
              setChosenMonth(todayMonth ?? undefined);
              setMonthOffset(0);
            }}
          >
            이번 달
          </button>
        </section>
        {selectedDate && (
          <MonthExpenses
            key={selectedDate.toISOString().slice(0, 7)}
            month={selectedDate.toISOString().slice(0, 7)}
          />
        )}
      </div>
    </main>
  );
}

function MonthExpenses({ month }: { month: string }) {
  const [result, setResult] = useState<PersonalExpenseMonth | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    listPersonalExpenses(month)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((failure: unknown) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [month, retry]);
  const groups = new Map<string, PersonalExpenseMonth["items"]>();
  for (const item of result?.items ?? []) {
    const group = groups.get(item.occurredOn) ?? [];
    group.push(item);
    groups.set(item.occurredOn, group);
  }
  return (
    <>
      <section className={styles.panel} aria-label="월간 개인 지출">
        <div className={styles.summary}>
          <h2>월간 개인 지출</h2>
          <strong>
            {result && !error
              ? `${BigInt(result.totalAmount).toLocaleString("ko-KR")}원`
              : "—"}
          </strong>
          {result && !error && <p>{result.items.length}건의 지출</p>}
        </div>
      </section>
      <section className={styles.panel} aria-labelledby="personal-list-title">
        <h2 id="personal-list-title">지출 내역</h2>
        {!result && !error && (
          <p role="status" className={styles.emptyState}>
            지출을 불러오는 중…
          </p>
        )}
        {error && (
          <div role="alert" className={styles.error}>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setError("");
                setResult(null);
                setRetry((value) => value + 1);
              }}
            >
              다시 시도
            </button>
          </div>
        )}
        {result && !error && result.items.length === 0 && (
          <div className={styles.emptyState}>
            <h3>등록한 개인 지출이 없어요</h3>
            <p>사용한 금액을 기록해 보세요.</p>
            <Link href="/personal-expenses/new">첫 지출 추가하기</Link>
          </div>
        )}
        {!error &&
          [...groups]
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, items]) => (
              <section
                key={date}
                className={styles.dateGroup}
                aria-label={`${date} 지출`}
              >
                <h3>{date}</h3>
                <ul className={styles.list}>
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/personal-expenses/${item.id}`}
                        className={styles.expenseLink}
                      >
                        <div className={styles.itemTop}>
                          <strong>{item.name}</strong>
                          <strong>
                            {item.amount.toLocaleString("ko-KR")}원
                          </strong>
                        </div>
                        <p>
                          {item.categoryName} · {item.paymentMethodName}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
      </section>
    </>
  );
}
