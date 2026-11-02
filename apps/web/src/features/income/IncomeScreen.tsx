"use client";

import Link from "@/shared/ui/AppLink";
import DisclosureChevron from "../../shared/ui/DisclosureChevron";
import { useEffect, useRef, useState } from "react";
import {
  deleteIncome,
  errorMessage,
  listIncomes,
  type Income,
  type IncomeMonth,
} from "./api";
import styles from "./income.module.css";
import MonthNavigation from "./MonthNavigation";
import { currentMonth } from "./month";

function money(value: string | number) {
  return BigInt(value).toLocaleString("ko-KR") + "원";
}

export default function IncomeScreen({
  initialMonth,
}: {
  initialMonth?: string;
}) {
  const [month, setMonth] = useState(() => initialMonth ?? currentMonth());
  const [data, setData] = useState<IncomeMonth | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setBusy] = useState(false);
  const busy = useRef(false);
  const [deleting, setDeleting] = useState<Income | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const addButton = useRef<HTMLAnchorElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);
  const ownerGroups = [
    ...new Set(data?.items.map((item) => item.ownerUserId) ?? []),
  ].map((id) => {
    const items = data!.items.filter((item) => item.ownerUserId === id);
    return {
      id,
      name: items[0].ownerName,
      items,
      total: items
        .reduce((sum, item) => sum + BigInt(item.amount), BigInt(0))
        .toString(),
    };
  });

  useEffect(() => {
    let active = true;
    listIncomes(month)
      .then((result) => {
        if (active) {
          setData(result);
          setLoadError("");
        }
      })
      .catch((e) => {
        if (active) setLoadError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, attempt]);
  useEffect(() => {
    if (deleting) dialog.current?.showModal();
  }, [deleting]);

  function refresh() {
    setLoading(true);
    setAttempt((n) => n + 1);
  }
  function closeDelete() {
    dialog.current?.close();
    setDeleting(null);
    setError("");
    deleteTrigger.current?.focus();
  }
  async function handleDelete() {
    if (!deleting || busy.current) return;
    busy.current = true;
    setBusy(true);
    setError("");
    try {
      await deleteIncome(deleting);
      closeDelete();
      addButton.current?.focus();
      refresh();
      setNotice("수입을 삭제했어요.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busy.current = false;
      setBusy(false);
    }
  }

  return (
    <main className={`${styles.screen} ${styles.overview}`}>
      <header className={styles.header}>
        <h1>수입</h1>
        <Link
          ref={addButton}
          className={styles.primary}
          href={`/income/new?month=${month}`}
          aria-label="수입 등록"
        >
          + 수입 등록
        </Link>
      </header>
      <MonthNavigation
        label="조회 월"
        value={month}
        today={currentMonth()}
        disabled={isBusy}
        onChange={(value) => {
          setMonth(value);
          setLoading(true);
          setNotice("");
        }}
      />
      {notice && <p role="status">{notice}</p>}
      {isLoading ? (
        <p role="status">수입을 불러오는 중…</p>
      ) : loadError ? (
        <div className={styles.card}>
          <p role="alert" className={styles.error}>
            {loadError}
          </p>
          <button className={styles.secondary} onClick={refresh}>
            다시 시도
          </button>
        </div>
      ) : (
        data && (
          <>
            <section className={styles.summary} aria-label="월 수입 합계">
              <span>총 수입</span>
              <strong>{money(data.totalAmount)}</strong>
              <span>{data.items.length}건의 수입</span>
            </section>
            <div className={styles.listHeader}>
              <h2>수입 내역</h2>
              <button
                className={styles.secondary}
                disabled={isBusy}
                onClick={refresh}
              >
                새로고침
              </button>
            </div>
            {data.items.length === 0 ? (
              <div className={styles.card}>
                <h3>아직 등록한 수입이 없어요</h3>
                <p>월급이나 부수입을 기록해 보세요.</p>
              </div>
            ) : (
              <div className={styles.ownerGroups}>
                {ownerGroups.map((group) => (
                  <section
                    className={styles.ownerGroup}
                    key={group.id}
                    data-disclosure
                  >
                    <button
                      type="button"
                      className={styles.ownerSummary}
                      data-disclosure-trigger
                      aria-expanded={expandedOwner === group.id}
                      aria-controls={`owner-${group.id}`}
                      onClick={() =>
                        setExpandedOwner(
                          expandedOwner === group.id ? null : group.id,
                        )
                      }
                    >
                      <span>
                        <strong>{group.name}</strong>
                        <small>{group.items.length}건</small>
                      </span>
                      <strong className={styles.ownerTotal}>
                        {money(group.total)}
                      </strong>
                      <DisclosureChevron />
                    </button>
                    <div
                      id={`owner-${group.id}`}
                      hidden={expandedOwner !== group.id}
                    >
                      <ul className={styles.list}>
                        {group.items.map((item) => (
                          <li key={item.id} className={styles.card}>
                            <div className={styles.item}>
                              <div>
                                <h3>{item.name}</h3>
                                <p className={styles.owner}>
                                  소유자 {item.ownerName}
                                </p>
                              </div>
                              <strong>{money(item.amount)}</strong>
                            </div>
                            <div className={styles.actions}>
                              <Link
                                className={styles.secondary}
                                aria-label={`${item.name} 수정`}
                                href={`/income/${item.id}/edit?month=${month}`}
                              >
                                수정
                              </Link>
                              <button
                                className={styles.secondary}
                                disabled={isBusy}
                                aria-label={`${item.name} 삭제`}
                                onClick={(e) => {
                                  deleteTrigger.current = e.currentTarget;
                                  setError("");
                                  setDeleting(item);
                                }}
                              >
                                삭제
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )
      )}
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="income-delete-heading"
        onCancel={(e) => {
          e.preventDefault();
          if (!isBusy) closeDelete();
        }}
      >
        <h2 id="income-delete-heading">수입을 삭제할까요?</h2>
        <p>{deleting?.name} 내역이 월 수입 합계에서 제외돼요.</p>
        {error && deleting && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            autoFocus
            disabled={isBusy}
            onClick={closeDelete}
          >
            취소
          </button>
          <button
            className={styles.primary}
            disabled={isBusy}
            onClick={handleDelete}
          >
            {isBusy ? "삭제 중…" : "삭제"}
          </button>
        </div>
      </dialog>
    </main>
  );
}
