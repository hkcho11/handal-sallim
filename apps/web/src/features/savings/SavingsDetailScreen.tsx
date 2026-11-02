"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  deleteSavings,
  depositLabel,
  errorMessage,
  getSavings,
  money,
  typeLabels,
  type Savings,
} from "./api";
import styles from "./savings.module.css";

export default function SavingsDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const [item, setItem] = useState<Savings>();
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [isDeleting, setDeleting] = useState(false);
  const busy = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    getSavings(id)
      .then((result) => {
        if (active) {
          setItem(result);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  function closeDelete() {
    dialog.current?.close();
    setDeleteError("");
    trigger.current?.focus();
  }
  async function handleDelete() {
    if (!item || busy.current) return;
    busy.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteSavings(item);
      router.push("/savings");
    } catch (e) {
      setDeleteError(errorMessage(e));
      busy.current = false;
      setDeleting(false);
    }
  }
  return (
    <main className={styles.screen}>
      <Link className={styles.back} href="/savings">
        ← 저축 목록
      </Link>
      {isLoading ? (
        <p role="status">저축을 불러오는 중…</p>
      ) : error ? (
        <div className={styles.card}>
          <h1>저축 상세</h1>
          <p role="alert" className={styles.error}>
            {error}
          </p>
          <button
            className={styles.secondary}
            onClick={() => {
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          >
            다시 시도
          </button>
        </div>
      ) : (
        item && (
          <>
            <header className={styles.header}>
              <div>
                <p className={styles.eyebrow}>{typeLabels[item.type]}</p>
                <h1>{item.name}</h1>
                <p className={styles.owner}>소유자 {item.ownerName}</p>
              </div>
              <Link className={styles.secondary} href={`/savings/${id}/edit`}>
                정보 수정
              </Link>
            </header>
            <section className={styles.summary} aria-label="현재 저축 금액">
              <span>현재 모은 금액</span>
              <strong>{money(item.currentAmount)}</strong>
              <span>
                {depositLabel(item.type)} {money(item.depositAmount)}
              </span>
            </section>
            <p className={styles.hint}>
              입력한 현재 금액을 보여줘요. 납입액은 자동으로 더하지 않아요.
            </p>
            <div className={styles.actions}>
              <button
                ref={trigger}
                className={styles.secondary}
                onClick={() => {
                  setDeleteError("");
                  dialog.current?.showModal();
                }}
              >
                저축 삭제
              </button>
            </div>
          </>
        )
      )}
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="delete-savings-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!isDeleting) closeDelete();
        }}
      >
        <h2 id="delete-savings-title">저축을 삭제할까요?</h2>
        <p>{item?.name} 내역이 목록과 합계에서 제외돼요.</p>
        {deleteError && (
          <p role="alert" className={styles.error}>
            {deleteError}
          </p>
        )}
        <div className={styles.actions}>
          <button
            autoFocus
            className={styles.secondary}
            disabled={isDeleting}
            onClick={closeDelete}
          >
            취소
          </button>
          <button
            className={styles.primary}
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? "삭제 중…" : "삭제"}
          </button>
        </div>
      </dialog>
    </main>
  );
}
