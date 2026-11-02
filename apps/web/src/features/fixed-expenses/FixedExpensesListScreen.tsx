"use client";
import { focusWhenReady } from "@/shared/loadingState";

import { useEffect, useRef, useState } from "react";
import Link from "@/shared/ui/AppLink";
import {
  FixedExpenseApiError,
  listFixedExpenses,
  type FixedExpense,
} from "./api";
import styles from "./fixed-expenses.module.css";
import SwipeableExpenseItem from "./SwipeableExpenseItem";
import DeleteFixedExpenseDialog from "./DeleteFixedExpenseDialog";
import { useFixedExpenseListFilters } from "./FixedExpenseListFilters";
import {
  compareFixedExpenses,
  overdueStatus,
  todayInSeoul,
} from "./expenseOrder";

export function expenseStatus(expense: FixedExpense) {
  if (expense.firstChargeStatus === "COMPLETED") return "완료";
  if (expense.firstChargeStatus === "OVERDUE")
    return overdueStatus(expense, todayInSeoul());
  if (expense.firstChargeId) return "예정";
  return "일정 미정";
}

export function expenseInterval(interval: FixedExpense["intervalMonths"]) {
  return interval === null
    ? "-"
    : { 1: "매월", 2: "격월", 3: "분기", 12: "매년" }[interval];
}

export function expenseError(error: unknown) {
  return error instanceof FixedExpenseApiError
    ? error.message
    : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}

export default function FixedExpensesListScreen() {
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<FixedExpense | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const { search, setSearch, category, setCategory, categoryScrollLeftRef } =
    useFixedExpenseListFilters();
  const categories = [
    ...new Set(expenses.map((item) => item.categoryName ?? "미지정")),
  ].sort((a, b) => a.localeCompare(b, "ko"));
  const selectedCategory = categories.includes(category) ? category : "";
  const query = search.trim().toLocaleLowerCase("ko").replace(/\s+/g, "");
  const filteredExpenses = expenses
    .filter((item) => {
      const title = [
        item.name,
        item.categoryName,
        item.subcategoryName,
        item.memo,
        item.paymentMethodName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko")
        .replace(/\s+/g, "");
      return (
        title.includes(query) &&
        (Boolean(query) ||
          !selectedCategory ||
          (item.categoryName ?? "미지정") === selectedCategory)
      );
    })
    .sort(compareFixedExpenses);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    listFixedExpenses(retry > 0)
      .then((result) => {
        if (active) setExpenses(result);
      })
      .catch((error: unknown) => {
        if (active) setError(expenseError(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  return (
    <main className={styles.page}>
      <header className={`${styles.header} ${styles.listHeader}`}>
        <div>
          <p className={styles.eyebrow}>반복되는 생활비</p>
          <h1>고정비</h1>
          <p>등록한 고정비를 한곳에서 확인하세요.</p>
        </div>
        <Link
          href="/entries/new"
          className={styles.addButton}
          aria-label="고정비 추가"
        >
          <span aria-hidden="true">+</span>
        </Link>
      </header>
      <section
        className={`${styles.panel} ${styles.listPanel}`}
        aria-labelledby="list-heading"
      >
        <div className={styles.sectionHeading}>
          <h2 ref={headingRef} id="list-heading" tabIndex={-1}>
            등록한 고정비
          </h2>
          {!loading && !error && (
            <span className={styles.count} role="status">
              {query || selectedCategory
                ? `${filteredExpenses.length} / ${expenses.length}개`
                : `${expenses.length}개`}
            </span>
          )}
        </div>
        {notice && (
          <p role="status" className={styles.notice}>
            {notice}
          </p>
        )}
        {loading && (
          <p role="status" className={styles.emptyState}>
            고정비를 불러오는 중…
          </p>
        )}
        {error && (
          <div role="alert" className={styles.error}>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                setRetry((value) => value + 1);
              }}
            >
              다시 시도
            </button>
          </div>
        )}
        {!loading && !error && expenses.length === 0 && (
          <div className={styles.emptyState}>
            <strong>아직 등록한 고정비가 없어요</strong>
            <p>대분류와 중분류, 금액을 입력해 시작해 보세요.</p>
            <Link href="/entries/new" className={styles.textLink}>
              첫 고정비 추가하기 →
            </Link>
          </div>
        )}
        {!loading && !error && expenses.length > 0 && (
          <>
            <div className={styles.listFilters}>
              <div className={styles.searchBar}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m16 16 4 4" />
                </svg>
                <input
                  id="fixed-expense-search"
                  type="search"
                  aria-label="중분류 검색"
                  value={search}
                  placeholder="고정비 검색"
                  enterKeyHint="search"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    if (event.target.value.trim()) {
                      setCategory("");
                      categoryScrollLeftRef.current = 0;
                    }
                    setRevealedId(null);
                  }}
                />
                {(search || selectedCategory) && (
                  <button
                    type="button"
                    aria-label="검색·필터 초기화"
                    title="검색·필터 초기화"
                    onClick={() => {
                      setSearch("");
                      setCategory("");
                      setRevealedId(null);
                    }}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                )}
              </div>
              <div
                className={styles.categoryFilters}
                ref={(element) => {
                  if (element)
                    element.scrollLeft = categoryScrollLeftRef.current;
                }}
                onScroll={(event) => {
                  categoryScrollLeftRef.current =
                    event.currentTarget.scrollLeft;
                }}
                role="group"
                aria-label="대분류 필터"
              >
                {["", ...categories].map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={selectedCategory === name}
                    onClick={() => {
                      setCategory(name);
                      setSearch("");
                      setRevealedId(null);
                    }}
                  >
                    {name || "전체"}
                  </button>
                ))}
              </div>
            </div>
            {filteredExpenses.length === 0 && (
              <div className={styles.emptyState}>
                <strong>조건에 맞는 고정비가 없어요</strong>
                <p>검색어나 대분류를 바꿔 보세요.</p>
              </div>
            )}
            <ul className={styles.list}>
              {filteredExpenses.map((expense) => (
                <li key={expense.id}>
                  <SwipeableExpenseItem
                    expense={expense}
                    revealed={revealedId === expense.id}
                    onReveal={(open) => setRevealedId(open ? expense.id : null)}
                    onDelete={() => {
                      setNotice("");
                      setDeletingExpense(expense);
                    }}
                  >
                    <div className={styles.itemTop}>
                      <div className={styles.itemIdentity}>
                        <span
                          className={styles.categoryTag}
                          aria-label={`대분류 ${expense.categoryName ?? "미지정"}`}
                        >
                          {expense.categoryName ?? "미지정"}
                        </span>
                        <strong className={styles.expenseSubcategory}>
                          {expense.subcategoryName ?? expense.name}
                        </strong>
                      </div>
                      <span className={styles.amount}>
                        {expense.expectedAmount.toLocaleString("ko-KR")}원
                      </span>
                    </div>
                    <div className={styles.itemMeta}>
                      <span>
                        {expenseInterval(expense.intervalMonths)} · 결제일{" "}
                        {expense.recurringDayOfMonth === null
                          ? "-"
                          : `${expense.recurringDayOfMonth}일`}
                      </span>
                      <span
                        className={styles.badge}
                        data-status={expense.firstChargeStatus ?? "UNSET"}
                      >
                        {expenseStatus(expense)}
                      </span>
                    </div>
                    <div className={styles.itemMeta}>
                      <span>결제수단 {expense.paymentMethodName ?? "-"}</span>
                      <span aria-hidden="true">→</span>
                    </div>
                  </SwipeableExpenseItem>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {deletingExpense && (
        <DeleteFixedExpenseDialog
          expense={deletingExpense}
          onCancel={() => setDeletingExpense(null)}
          onDeleted={() => {
            setExpenses((current) =>
              current.filter((item) => item.id !== deletingExpense.id),
            );
            setDeletingExpense(null);
            setRevealedId(null);
            setNotice("고정비를 삭제했습니다.");
            focusWhenReady(headingRef.current);
          }}
        />
      )}
    </main>
  );
}
