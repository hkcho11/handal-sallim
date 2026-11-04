"use client";
import Link from "@/shared/ui/AppLink";
import { useEffect, useState } from "react";
import {
  listPaymentMethods,
  listMembers,
  typeLabels,
  errorMessage,
  type PaymentMethod,
  type Member,
} from "./api";
import styles from "@/features/settings/settings.module.css";

export default function PaymentMethodsScreen() {
  const [items, setItems] = useState<PaymentMethod[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [holderFilter, setHolderFilter] = useState("");
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([listPaymentMethods(), listMembers()])
      .then(([result, people]) => {
        if (active) {
          setItems(result);
          setMembers(people);
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
  const inStatus = items.filter(
    (item) => item.status === (showArchived ? "ARCHIVED" : "ACTIVE"),
  );
  const visible = inStatus.filter(
    (item) =>
      (!typeFilter || item.type === typeFilter) &&
      (!holderFilter ||
        (holderFilter === "unassigned"
          ? item.holderUserId === null
          : item.holderUserId === holderFilter)),
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
      <p>고정비에 사용할 카드·간편결제·계좌·현금을 관리해요.</p>
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
          <div className={styles.paymentFilters}>
            <label className={styles.field}>
              종류
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="">전체 종류</option>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              명의자 / 담당자
              <select
                value={holderFilter}
                onChange={(event) => setHolderFilter(event.target.value)}
              >
                <option value="">전체 명의자</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
                <option value="unassigned">미지정</option>
              </select>
            </label>
          </div>
          {(typeFilter || holderFilter) && (
            <button
              className={styles.secondary}
              onClick={() => {
                setTypeFilter("");
                setHolderFilter("");
              }}
            >
              필터 초기화
            </button>
          )}
          <h2 aria-live="polite">
            {showArchived ? "보관한 결제수단" : "사용 중인 결제수단"}{" "}
            {visible.length}개
          </h2>
          {visible.length === 0 && inStatus.length > 0 ? (
            <div className={styles.card}>
              <strong>조건에 맞는 결제수단이 없어요</strong>
              <p>종류나 명의자를 바꾸거나 필터를 초기화해 주세요.</p>
            </div>
          ) : visible.length === 0 ? (
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
                  <small>
                    {typeLabels[item.type]} ·{" "}
                    {members.find((member) => member.id === item.holderUserId)
                      ?.name ?? "미지정"}
                  </small>
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
