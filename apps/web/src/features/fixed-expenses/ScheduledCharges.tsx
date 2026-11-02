"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import WonInput from "../../shared/ui/WonInput";
import {
  getFixedExpenseFormOptions,
  type FixedExpenseFormOptions,
} from "./api";
import { completeCharge, loadCharges, type ScheduledCharge } from "./chargeApi";
import styles from "./fixed-expenses.module.css";

export default function ScheduledCharges({
  expenseId,
  onCompleted,
}: {
  expenseId: string;
  onCompleted: () => void;
}) {
  const selectedId = useSearchParams().get("charge");
  const [charges, setCharges] = useState<ScheduledCharge[] | null>(null);
  const [selected, setSelected] = useState<ScheduledCharge | null>(null);
  const [methods, setMethods] = useState<
    FixedExpenseFormOptions["paymentMethods"]
  >([]);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [method, setMethod] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  useEffect(() => {
    let active = true;
    loadCharges(expenseId)
      .then((items) => {
        if (active) {
          setCharges(items);
          setError("");
        }
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "결제 내역을 불러오지 못했습니다.",
          );
      });
    return () => {
      active = false;
    };
  }, [expenseId, retry]);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);
  async function open(charge: ScheduledCharge) {
    if (busy) return;
    setBusy(true);
    setError("");
    setFormError("");
    setNotice("");
    try {
      const options = await getFixedExpenseFormOptions();
      setMethods(options.paymentMethods);
      setValue("");
      setPaidOn(charge.dueDate);
      setMethod(
        options.paymentMethods.some(
          (m) => m.id === charge.plannedPaymentMethodId,
        )
          ? charge.plannedPaymentMethodId!
          : "",
      );
      setSelected(charge);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "결제수단을 불러오지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (busy) return;
    dialog.current?.close();
    setSelected(null);
  }
  return (
    <section
      className={`${styles.panel} ${styles.chargePanel}`}
      aria-label="회차별 결제 내역"
    >
      <h2>회차별 결제 내역</h2>
      <p className={styles.fieldHint}>
        예정 회차는 반복 설정에 따라 생성됩니다. 실제 납부한 뒤 결제 완료로
        확정해 주세요.
      </p>
      {error && (
        <div role="alert" className={styles.error}>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setError("");
              setRetry((v) => v + 1);
            }}
          >
            결제 내역 다시 불러오기
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {!charges && !error && <p role="status">결제 내역을 불러오는 중…</p>}
      {charges?.length === 0 && (
        <p>반복 일정이 정해지면 예정 청구가 표시됩니다.</p>
      )}
      <ul className={styles.chargeList}>
        {charges
          ?.toSorted(
            (a, b) =>
              b.dueDate.localeCompare(a.dueDate) || b.id.localeCompare(a.id),
          )
          .map((charge) => (
            <li key={charge.id} data-highlight={selectedId === charge.id}>
              <div>
                <strong>{charge.dueDate}</strong>
                <span>
                  {charge.status === "COMPLETED"
                    ? "완료"
                    : charge.dueDate < today
                      ? "지연"
                      : "예정"}
                  {charge.actualAmount !== null
                    ? ` · ${charge.actualAmount.toLocaleString("ko-KR")}원`
                    : ""}
                </span>
                <small>
                  {charge.paymentMethodName ?? "결제수단 미지정"}
                  {charge.actualPaidOn
                    ? ` · 실제 결제일 ${charge.actualPaidOn}`
                    : ""}
                </small>
              </div>
              {charge.status === "PENDING" && (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={busy}
                  onClick={() => void open(charge)}
                  aria-label={`${charge.dueDate} 결제 완료`}
                >
                  결제 완료
                </button>
              )}
            </li>
          ))}
      </ul>
      <dialog
        ref={dialog}
        className={styles.completionDialog}
        aria-labelledby="payment-completion-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        {selected && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              const amount = Number(value);
              if (
                !/^\d+$/.test(value) ||
                !Number.isSafeInteger(amount) ||
                amount <= 0
              ) {
                setFormError(
                  "실제 결제 금액은 1원 이상의 정수로 입력해 주세요.",
                );
                return;
              }
              if (paidOn > today) {
                setFormError("실제 결제일은 오늘 이후로 지정할 수 없습니다.");
                return;
              }
              if (!method) {
                setFormError("실제로 사용한 결제수단을 선택해 주세요.");
                return;
              }
              setBusy(true);
              setFormError("");
              try {
                await completeCharge(selected.id, {
                  amount,
                  paidOn,
                  paymentMethodId: method,
                  version: selected.version,
                });
                dialog.current?.close();
                setSelected(null);
                setNotice("결제를 완료하고 실제 지출에 반영했습니다.");
                setRetry((v) => v + 1);
                onCompleted();
              } catch (error) {
                setFormError(
                  error instanceof Error
                    ? error.message
                    : "결제를 처리하지 못했습니다.",
                );
              } finally {
                setBusy(false);
              }
            }}
            aria-busy={busy}
          >
            <header className={styles.completionHeader}>
              <h2 id="payment-completion-title">결제 완료 확인</h2>
              <button
                type="button"
                className={styles.completionClose}
                aria-label="결제 완료 창 닫기"
                title="닫기"
                disabled={busy}
                onClick={close}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>
            <p>
              {selected.name} · 예정일 {selected.dueDate}
            </p>
            <label>
              실제 결제 금액
              <WonInput
                digitsOnly
                autoFocus
                required
                value={value}
                onValueChange={setValue}
                disabled={busy}
              />
            </label>
            <label>
              실제 결제일
              <input
                type="date"
                required
                value={paidOn}
                max={today}
                min="0001-01-01"
                disabled={busy}
                onChange={(event) => setPaidOn(event.target.value)}
              />
            </label>
            <label>
              실제 결제수단
              <select
                required
                value={method}
                disabled={busy}
                onChange={(event) => setMethod(event.target.value)}
              >
                <option value="">결제수단 선택</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <p>확정하면 실제 지출 기록이 한 건 생성됩니다.</p>
            {formError && (
              <p role="alert" className={styles.error}>
                {formError}
              </p>
            )}
            <div className={styles.chargeActions}>
              <button className={styles.primaryButton} disabled={busy}>
                {busy ? "처리 중…" : "확인하고 결제 완료"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
