"use client";

import Link from "@/shared/ui/AppLink";
import { useEffect, useState } from "react";
import {
  listSavings,
  errorMessage,
  money,
  typeLabels,
  depositLabel,
  type SavingsOverview,
} from "./api";
import styles from "./savings.module.css";

export default function SavingsListScreen() {
  const [data, setData] = useState<SavingsOverview>();
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    listSavings(attempt > 0)
      .then((result) => {
        if (active) {
          setData(result);
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
  }, [attempt]);
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>차곡차곡 모으는 내일</span>
          <h1>저축</h1>
        </div>
        <Link
          className={styles.primary}
          href="/savings/new"
          aria-label="저축 등록"
        >
          + 저축 등록
        </Link>
      </header>
      <p className={styles.description}>
        예금과 적금을 한곳에서 관리해요. 공간 멤버와 함께 볼 수 있어요.
      </p>
      {isLoading ? (
        <p role="status">저축을 불러오는 중…</p>
      ) : error ? (
        <div className={styles.card}>
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
        data && (
          <>
            <section className={styles.summary} aria-label="저축 합계">
              <span>현재 모은 금액</span>
              <strong>{money(data.totalCurrentAmount)}</strong>
              <span>적금 월 납입액 {money(data.monthlyDepositAmount)}</span>
              <small>
                입력한 현재 금액을 합산해요. 납입액은 자동으로 더하지 않아요.
              </small>
            </section>
            <div className={styles.listHeader}>
              <h2>등록한 저축 {data.items.length}개</h2>
              <button
                className={styles.secondary}
                onClick={() => {
                  setLoading(true);
                  setAttempt((n) => n + 1);
                }}
              >
                새로고침
              </button>
            </div>
            {data.items.length === 0 ? (
              <div className={styles.card}>
                <h3>아직 등록한 저축이 없어요</h3>
                <p>기존 예적금도 현재 모은 금액과 함께 등록해 보세요.</p>
              </div>
            ) : (
              <ul className={styles.list}>
                {data.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      className={`${styles.card} ${styles.rowLink}`}
                      href={`/savings/${item.id}`}
                    >
                      <small>
                        {typeLabels[item.type]} · 소유자 {item.ownerName}
                      </small>
                      <div className={styles.item}>
                        <h3>{item.name}</h3>
                        <strong>{money(item.currentAmount)}</strong>
                      </div>
                      <p className={styles.hint}>
                        {depositLabel(item.type)} {money(item.depositAmount)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      )}
    </main>
  );
}
