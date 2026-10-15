"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  createFixedExpense,
  FixedExpenseApiError,
  listFixedExpenses,
  type FixedExpense,
  type NewFixedExpense,
} from "./api";
import styles from "./fixed-expenses.module.css";

const INTERVALS = [
  { value: 1, label: "매월" },
  { value: 2, label: "격월" },
  { value: 3, label: "분기" },
  { value: 12, label: "매년" },
] as const;

function messageOf(error: unknown): string {
  return error instanceof FixedExpenseApiError
    ? error.message
    : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}

function parseAmount(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isSafeInteger(amount) ? amount : null;
}

export default function FixedExpensesScreen() {
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [interval, setInterval] = useState("");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const creationKey = useRef<string | null>(null);

  async function load() {
    setIsLoading(true);
    setListError("");
    try {
      setExpenses(await listFixedExpenses());
    } catch (error) {
      setListError(messageOf(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    listFixedExpenses()
      .then((items) => {
        if (active) setExpenses(items);
      })
      .catch((error: unknown) => {
        if (active) setListError(messageOf(error));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function resetCreationKey() {
    creationKey.current = null;
    setFormError("");
    setNotice("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const parsedAmount = parseAmount(amount);
    const parsedInterval = Number(interval);
    if (
      !name.trim() ||
      name.trim().length > 120 ||
      parsedAmount === null ||
      ![1, 2, 3, 12].includes(parsedInterval) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)
    ) {
      setFormError(
        "비용명, 원 단위 금액, 반복 주기와 첫 예정일을 확인해 주세요.",
      );
      return;
    }
    const input: NewFixedExpense = {
      name: name.trim(),
      expectedAmount: parsedAmount,
      intervalMonths: parsedInterval as NewFixedExpense["intervalMonths"],
      firstDueDate,
    };
    creationKey.current ??= crypto.randomUUID();
    setIsSaving(true);
    setFormError("");
    try {
      const created = await createFixedExpense(input, creationKey.current);
      setExpenses((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);
      setName("");
      setAmount("");
      setInterval("");
      setFirstDueDate("");
      creationKey.current = null;
      setNotice("고정비와 첫 예정 청구를 등록했습니다.");
    } catch (error) {
      setFormError(messageOf(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          한달살림
        </Link>
        <h1>내역 추가</h1>
        <p>고정비의 첫 예정일을 등록하고 확인하세요.</p>
      </header>

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="add-heading">
          <h2 id="add-heading">고정비</h2>
          <p className={styles.muted}>
            담당자와 결제수단은 나중에 지정할 수 있습니다.
          </p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="expense-name">비용명</label>
            <input
              id="expense-name"
              disabled={isSaving}
              maxLength={120}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                resetCreationKey();
              }}
              required
              placeholder="예: 월세"
            />

            <label htmlFor="expense-amount">최초 예상 금액 (원)</label>
            <input
              id="expense-amount"
              disabled={isSaving}
              inputMode="numeric"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                resetCreationKey();
              }}
              required
              placeholder="650000"
            />

            <label htmlFor="expense-interval">반복 주기</label>
            <select
              id="expense-interval"
              data-align="center"
              disabled={isSaving}
              value={interval}
              onChange={(event) => {
                setInterval(event.target.value);
                resetCreationKey();
              }}
              required
            >
              <option value="">선택하세요</option>
              {INTERVALS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <label htmlFor="expense-date">첫 예정일</label>
            <input
              id="expense-date"
              disabled={isSaving}
              type="date"
              value={firstDueDate}
              onChange={(event) => {
                setFirstDueDate(event.target.value);
                resetCreationKey();
              }}
              required
            />

            {formError && (
              <p role="alert" className={styles.error}>
                {formError}
              </p>
            )}
            {notice && (
              <p role="status" className={styles.notice}>
                {notice}
              </p>
            )}
            <button
              type="submit"
              disabled={isSaving || isLoading || Boolean(listError)}
            >
              {isSaving ? "저장 중…" : "고정비 저장"}
            </button>
          </form>
        </section>

        <section className={styles.panel} aria-labelledby="list-heading">
          <h2 id="list-heading">등록한 고정비</h2>
          {isLoading && <p role="status">불러오는 중…</p>}
          {listError && (
            <div role="alert" className={styles.error}>
              <p>{listError}</p>
              <button type="button" onClick={() => void load()}>
                다시 시도
              </button>
            </div>
          )}
          {!isLoading && !listError && expenses.length === 0 && (
            <p className={styles.muted}>등록한 고정비가 없습니다.</p>
          )}
          {!isLoading && !listError && expenses.length > 0 && (
            <ul className={styles.list}>
              {expenses.map((expense) => (
                <li key={expense.id} className={styles.item}>
                  <div className={styles.itemTop}>
                    <strong>{expense.name}</strong>
                    <span>
                      {expense.expectedAmount.toLocaleString("ko-KR")}원
                    </span>
                  </div>
                  <div className={styles.itemMeta}>
                    <span>
                      {
                        INTERVALS.find(
                          (item) => item.value === expense.intervalMonths,
                        )?.label
                      }
                    </span>
                    <span>첫 예정 {expense.firstDueDate}</span>
                    <span>
                      {expense.firstChargeStatus === "OVERDUE"
                        ? "지연"
                        : expense.firstChargeStatus === "COMPLETED"
                          ? "완료"
                          : "예정"}
                    </span>
                  </div>
                  <p className={styles.muted}>
                    담당자 미지정 · 결제수단 미지정
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
