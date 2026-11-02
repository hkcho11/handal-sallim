"use client";
import Link from "@/shared/ui/AppLink";
import { useEffect, useState } from "react";
import {
  listPaymentMethods,
  typeLabels,
  errorMessage,
  type PaymentMethod,
} from "./api";
import styles from "@/features/settings/settings.module.css";

export default function PaymentMethodsScreen() {
  const [items, setItems] = useState<PaymentMethod[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => {
    let active = true;
    listPaymentMethods()
      .then((result) => {
        if (active) {
          setItems(result);
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
  const visible = items.filter(
    (item) => item.status === (showArchived ? "ARCHIVED" : "ACTIVE"),
  );
  return (
    <main className={styles.screen}>
      <Link href="/settings" className={styles.back}>
        ‹ 설정
      </Link>
      <header className={styles.header}>
        <h1>결제수단</h1>
        <Link
          className={styles.primary}
          href="/payment-methods/new"
          aria-label="결제수단 추가"
        >
          + 추가
        </Link>
      </header>
      <p>고정비에 사용할 카드·계좌·현금을 관리해요.</p>
      <div className={`${styles.actions} ${styles.statusFilters}`}>
        <button
          className={styles.secondary}
          aria-pressed={!showArchived}
          onClick={() => setShowArchived(false)}
        >
          사용 중
        </button>
        <button
          className={styles.secondary}
          aria-pressed={showArchived}
          onClick={() => setShowArchived(true)}
        >
          보관함
        </button>
      </div>
      {isLoading ? (
        <p role="status">결제수단을 불러오는 중…</p>
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
        <>
          <h2>
            {showArchived ? "보관한 결제수단" : "사용 중인 결제수단"}{" "}
            {visible.length}개
          </h2>
          {visible.length === 0 ? (
            <div className={styles.card}>
              <strong>
                {showArchived
                  ? "보관한 결제수단이 없어요"
                  : "등록한 결제수단이 없어요"}
              </strong>
              <p>
                {showArchived
                  ? "사용하지 않는 결제수단은 상세 화면에서 보관할 수 있어요."
                  : "자주 사용하는 결제수단을 추가해 보세요."}
              </p>
            </div>
          ) : (
            visible.map((item) => (
              <Link
                className={styles.row}
                key={item.id}
                href={`/payment-methods/${item.id}`}
              >
                <span>
                  <strong>
                    <span
                      className={styles.swatch}
                      style={{ background: item.color ?? "#687182" }}
                    />
                    {item.name}
                  </strong>
                  <small>{typeLabels[item.type]}</small>
                </span>
                <span aria-hidden="true">›</span>
              </Link>
            ))
          )}
        </>
      )}
    </main>
  );
}
