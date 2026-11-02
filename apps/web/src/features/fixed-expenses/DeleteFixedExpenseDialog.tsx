"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteFixedExpense,
  FixedExpenseApiError,
  type FixedExpense,
} from "./api";
import styles from "./fixed-expenses.module.css";

export default function DeleteFixedExpenseDialog({
  expense,
  onCancel,
  onDeleted,
}: {
  expense: FixedExpense;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    active.current = true;
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => {
      active.current = false;
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);

  async function confirm() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    dialogRef.current?.focus({ preventScroll: true });
    setError("");
    try {
      await deleteFixedExpense(expense.id);
      if (active.current) onDeleted();
    } catch (error) {
      if (!active.current) return;
      setError(
        error instanceof FixedExpenseApiError
          ? error.message
          : "삭제하지 못했습니다. 다시 시도해 주세요.",
      );
      setBusy(false);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.deleteDialog}
      aria-labelledby="delete-expense-title"
      aria-describedby="delete-expense-description"
      aria-busy={busy}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (!first || !last) return;
        if (submitting.current) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialogRef.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === dialogRef.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting.current) onCancel();
      }}
    >
      <h2 id="delete-expense-title">고정비를 삭제할까요?</h2>
      <p className={styles.deleteName}>
        {expense.subcategoryName ?? expense.name}
      </p>
      <p id="delete-expense-description" className={styles.muted}>
        목록에서 제거하고 현재와 이후의 미완료 예정 청구를 취소합니다. 완료된
        지출 기록은 유지됩니다.
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.dialogActions}>
        <button
          ref={cancelRef}
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          취소
        </button>
        <button
          ref={confirmRef}
          type="button"
          className={styles.confirmDelete}
          disabled={busy}
          onClick={() => void confirm()}
        >
          {busy ? "삭제 중…" : "삭제"}
        </button>
      </div>
    </dialog>
  );
}
