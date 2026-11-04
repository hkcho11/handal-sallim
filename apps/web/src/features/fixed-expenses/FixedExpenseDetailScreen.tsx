"use client";

import { useEffect, useState } from "react";
import Link from "@/shared/ui/AppLink";
import { useAppRouter as useRouter } from "@/shared/ui/useAppRouter";
import { listFixedExpenses, type FixedExpense } from "./api";
import FixedExpensesScreen from "./FixedExpensesScreen";
import {
  expenseError,
  expenseInterval,
  expenseStatus,
} from "./FixedExpensesListScreen";
import styles from "./fixed-expenses.module.css";
import TrashIcon from "./TrashIcon";
import DeleteFixedExpenseDialog from "./DeleteFixedExpenseDialog";
import ScheduledCharges from "./ScheduledCharges";

export default function FixedExpenseDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const [expense, setExpense] = useState<FixedExpense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let active = true;
    listFixedExpenses()
      .then((items) => {
        if (!active) return;
        const item = items.find((item) => item.id === id);
        setExpense(item ?? null);
        if (!item) setError("고정비를 찾을 수 없습니다.");
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
  }, [id, retry]);

  if (expense && editing)
    return (
      <FixedExpensesScreen
        expense={expense}
        onSaved={(updated) => {
          setExpense(updated);
          setEditing(false);
          if (updated !== expense) setNotice("고정비 정보를 수정했습니다.");
        }}
      />
    );
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/fixed-costs" className={styles.back}>
          ← 고정비 목록
        </Link>
        <h1>고정비 상세</h1>
      </header>
      <section
        className={`${styles.panel} ${styles.formPanel}`}
        aria-label="고정비 정보"
      >
        {loading && <p role="status">불러오는 중…</p>}
        {error && (
          <div className={styles.error} role="alert">
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
        {!loading && !error && expense && (
          <>
            <div className={styles.sectionHeading}>
              <span
                className={styles.badge}
                data-status={expense.firstChargeStatus ?? "UNSET"}
              >
                {expenseStatus(expense)}
              </span>
              <button
                type="button"
                className={styles.deleteIconButton}
                aria-label="고정비 삭제"
                title="고정비 삭제"
                onClick={() => setDeleting(true)}
              >
                <TrashIcon />
              </button>
            </div>
            <h2 className={styles.detailTitle}>
              {expense.subcategoryName ?? expense.name}
            </h2>
            {expense.billingMode === "VARIABLE" ? (
              <p className={styles.fieldHint}>
                {expense.billingMonth}부터 월별 결제 내역을 직접 입력해요.
              </p>
            ) : (
              <p className={styles.detailAmount}>
                <span>등록 금액 </span>
                {expense.expectedAmount?.toLocaleString("ko-KR")}
                <span>원</span>
              </p>
            )}
            <dl className={styles.detailGrid}>
              <div>
                <dt>금액 변동 여부</dt>
                <dd>
                  {expense.billingMode === "VARIABLE"
                    ? "금액 변동 · 수동 입력"
                    : expense.billingMode === "FIXED"
                      ? "금액 일정 · 자동 기록"
                      : "기존 방식"}
                </dd>
              </div>
              <div>
                <dt>대분류</dt>
                <dd>{expense.categoryName ?? "-"}</dd>
              </div>
              <div>
                <dt>중분류</dt>
                <dd>{expense.subcategoryName ?? "-"}</dd>
              </div>
              <div>
                <dt>메모</dt>
                <dd>
                  {expense.memo ??
                    (!expense.subcategoryId ? expense.name : "-")}
                </dd>
              </div>
              {expense.billingMode !== "VARIABLE" && (
                <>
                  <div>
                    <dt>반복주기</dt>
                    <dd>{expenseInterval(expense.intervalMonths)}</dd>
                  </div>
                  <div>
                    <dt>반복 결제일</dt>
                    <dd>
                      {expense.recurringDayOfMonth === null
                        ? "-"
                        : `${expense.recurringDayOfMonth}일`}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt>결제자</dt>
                <dd>
                  {expense.payer === "ME"
                    ? "나"
                    : expense.payer === "PARTNER"
                      ? "상대"
                      : "-"}
                </dd>
              </div>
              {expense.billingMode !== "VARIABLE" && (
                <>
                  <div>
                    <dt>결제수단</dt>
                    <dd>{expense.paymentMethodName ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>첫 결제일</dt>
                    <dd>{expense.firstDueDate ?? "-"}</dd>
                  </div>
                </>
              )}
            </dl>
            {!expense.firstChargeId &&
              (!expense.billingMode || expense.billingMode === "LEGACY") && (
                <p className={styles.fieldHint}>
                  반복주기, 반복 결제일과 첫 결제일이 정해지면 예정 청구를
                  만들어요.
                </p>
              )}
            {notice && (
              <p role="status" className={styles.notice}>
                {notice}
              </p>
            )}
            {expense.billingMode === "FIXED" && !expense.paymentMethodId && (
              <p role="status" className={styles.fieldHint}>
                자동 기록에 사용할 결제수단이 없어요. 정보 수정에서 결제수단을
                선택해 주세요.
              </p>
            )}
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setNotice("");
                setEditing(true);
              }}
            >
              정보 수정
            </button>
          </>
        )}
      </section>
      {!loading && !error && expense && (
        <ScheduledCharges
          expenseId={id}
          expense={expense}
          onCompleted={() => setRetry((value) => value + 1)}
        />
      )}
      {deleting && expense && (
        <DeleteFixedExpenseDialog
          expense={expense}
          onCancel={() => setDeleting(false)}
          onDeleted={() => router.replace("/fixed-costs")}
        />
      )}
    </main>
  );
}
