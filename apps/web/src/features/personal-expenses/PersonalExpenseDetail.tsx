"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deletePersonalExpense,
  errorMessage,
  getPersonalExpense,
  type PersonalExpense,
} from "./api";
import PersonalExpenseForm from "./PersonalExpenseForm";
import styles from "./personal-expenses.module.css";

export default function PersonalExpenseDetail({ id }: { id: string }) {
  const [expense, setExpense] = useState<PersonalExpense | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    getPersonalExpense(id)
      .then((data) => {
        if (active) setExpense(data);
      })
      .catch((failure: unknown) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  if (editing && expense)
    return (
      <PersonalExpenseForm
        key={`${expense.id}-${expense.version}`}
        current={expense}
        initialDate={expense.occurredOn}
        onCancel={() => {
          setEditing(false);
          requestAnimationFrame(() => heading.current?.focus());
        }}
        onSaved={(saved) => {
          setExpense(saved);
          setEditing(false);
          setNotice("지출을 수정했습니다.");
          requestAnimationFrame(() => heading.current?.focus());
        }}
      />
    );
  return (
    <main className={styles.page}>
      <div className={`${styles.container} ${styles.formContainer}`}>
        <header className={styles.header}>
          <div>
            <Link
              className={styles.back}
              href={
                expense
                  ? `/personal-expenses?month=${expense.occurredOn.slice(0, 7)}`
                  : "/personal-expenses"
              }
            >
              ← 개인 지출 목록
            </Link>
            <h1 ref={heading} tabIndex={-1}>
              지출 상세
            </h1>
          </div>
        </header>
        {!expense && !error && <p role="status">지출을 불러오는 중…</p>}
        {error && (
          <div role="alert" className={styles.error}>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setError("");
                setRetry((value) => value + 1);
              }}
            >
              다시 시도
            </button>
          </div>
        )}
        {expense && (
          <section className={styles.panel} aria-label="지출 정보">
            {notice && <p role="status">{notice}</p>}
            <h2>{expense.name}</h2>
            <p className={styles.detailAmount}>
              {expense.amount.toLocaleString("ko-KR")}원
            </p>
            <dl className={styles.details}>
              <dt>날짜</dt>
              <dd>{expense.occurredOn}</dd>
              <dt>카테고리</dt>
              <dd>{expense.categoryName}</dd>
              <dt>결제수단</dt>
              <dd>{expense.paymentMethodName}</dd>
              <dt>메모</dt>
              <dd className={styles.memo}>{expense.memo ?? "—"}</dd>
            </dl>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => {
                  setNotice("");
                  setEditing(true);
                }}
              >
                정보 수정
              </button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => setDeleting(true)}
              >
                지출 삭제
              </button>
            </div>
          </section>
        )}
        {expense && deleting && (
          <DeleteDialog expense={expense} onCancel={() => setDeleting(false)} />
        )}
      </div>
    </main>
  );
}

function DeleteDialog({
  expense,
  onCancel,
}: {
  expense: PersonalExpense;
  onCancel: () => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    active.current = true;
    const opener = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    cancel.current?.focus();
    return () => {
      active.current = false;
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  async function confirm() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    dialog.current?.focus();
    try {
      await deletePersonalExpense(expense);
      if (active.current)
        router.push(
          `/personal-expenses?month=${expense.occurredOn.slice(0, 7)}`,
        );
    } catch (failure) {
      if (active.current) {
        setError(errorMessage(failure));
        setBusy(false);
      }
    } finally {
      submitting.current = false;
    }
  }
  return (
    <dialog
      ref={dialog}
      className={styles.deleteDialog}
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      tabIndex={-1}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting.current) onCancel();
      }}
    >
      <h2 id="delete-title">개인 지출을 삭제할까요?</h2>
      <p>{expense.name}</p>
      <p id="delete-description">
        서버에서도 완전히 삭제하며 복구할 수 없습니다. 월간 합계에서도
        제외됩니다.
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button ref={cancel} type="button" disabled={busy} onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          className={styles.danger}
          disabled={busy}
          onClick={() => void confirm()}
        >
          {busy ? "삭제 중…" : "삭제"}
        </button>
      </div>
    </dialog>
  );
}
