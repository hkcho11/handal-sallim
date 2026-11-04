"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import WonInput from "../../shared/ui/WonInput";
import {
  getFixedExpenseFormOptions,
  type FixedExpense,
  type FixedExpenseFormOptions,
} from "./api";
import {
  completeCharge,
  editPayment,
  loadCharges,
  recordPayment,
  type ScheduledCharge,
} from "./chargeApi";
import styles from "./fixed-expenses.module.css";

export default function ScheduledCharges({
  expenseId,
  expense,
  onCompleted,
}: {
  expenseId: string;
  expense?: FixedExpense;
  onCompleted: () => void;
}) {
  const [charges, setCharges] = useState<ScheduledCharge[] | null>(null);
  const [editing, setEditing] = useState<ScheduledCharge | "new" | null>(null);
  const [methods, setMethods] = useState<
    FixedExpenseFormOptions["paymentMethods"]
  >([]);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const key = useRef<string | null>(null);
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [value, setValue] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [method, setMethod] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let active = true;
    loadCharges(expenseId)
      .then((items) => {
        if (active) {
          setCharges(items);
          setError("");
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "결제 내역을 불러오지 못했습니다.",
          );
      });
    return () => {
      active = false;
    };
  }, [expenseId, retry]);
  useEffect(() => {
    if (editing) formRef.current?.scrollIntoView({ block: "nearest" });
  }, [editing]);
  async function open(item: ScheduledCharge | "new") {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFormError("");
    setError("");
    try {
      const options = await getFixedExpenseFormOptions();
      setMethods(options.paymentMethods);
      setEditing(item);
      key.current = null;
      setValue(item === "new" ? "" : (item.actualAmount?.toString() ?? ""));
      setMonth(
        item === "new"
          ? charges?.length
            ? today.slice(0, 7)
            : (expense?.billingMonth ?? today.slice(0, 7))
          : (item.billingMonth ?? item.dueDate.slice(0, 7)),
      );
      setPaidOn(item === "new" ? today : (item.actualPaidOn ?? item.dueDate));
      setMethod(
        item === "new"
          ? (expense?.paymentMethodId ?? "")
          : (item.actualPaymentMethodId ?? item.plannedPaymentMethodId ?? ""),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "결제수단을 불러오지 못했습니다.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function changed() {
    key.current = null;
    setFormError("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing || busyRef.current) return;
    const amount = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(amount)) {
      setFormError("결제 금액은 1원 이상의 정수로 입력해 주세요.");
      return;
    }
    if (!month || !paidOn || !method) {
      setFormError("해당 월·결제일·결제수단을 입력해 주세요.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setFormError("");
    key.current ??= crypto.randomUUID();
    const input = {
      billingMonth: month,
      amount,
      paidOn,
      paymentMethodId: method,
      version: editing === "new" ? 0 : editing.version,
    };
    try {
      if (editing === "new") await recordPayment(expenseId, input, key.current);
      else if (editing.status === "COMPLETED")
        await editPayment(editing.id, input);
      else await completeCharge(editing.id, input);
      setEditing(null);
      setRetry((v) => v + 1);
      onCompleted();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "결제 내역을 저장하지 못했습니다.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className={`${styles.panel} ${styles.chargePanel}`}
      aria-label="회차별 결제 내역"
    >
      <div className={styles.sectionHeading}>
        <h2>회차별 결제 내역</h2>
        {expense?.billingMode === "VARIABLE" && (
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={busy || editing !== null}
            onClick={() => void open("new")}
          >
            + 결제 내역 입력
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className={styles.error}>
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            결제 내역 다시 불러오기
          </button>
        </div>
      )}
      {charges === null && !error && (
        <p role="status">결제 내역을 불러오는 중…</p>
      )}
      {charges?.length === 0 && <p>등록한 결제 내역이 없어요.</p>}
      <ul className={styles.chargeList}>
        {charges
          ?.toSorted(
            (a, b) =>
              (b.billingMonth ?? b.dueDate.slice(0, 7)).localeCompare(
                a.billingMonth ?? a.dueDate.slice(0, 7),
              ) ||
              b.dueDate.localeCompare(a.dueDate) ||
              b.id.localeCompare(a.id),
          )
          .map((c) => (
            <li key={c.id}>
              <div>
                <span>
                  {c.billingMonth ?? c.dueDate.slice(0, 7)} ·{" "}
                  {expense?.subcategoryName ?? c.name}
                </span>
                <strong className={styles.paymentAmount}>
                  {c.actualAmount === null
                    ? "미결제"
                    : `${c.actualAmount.toLocaleString("ko-KR")}원`}
                </strong>
                <small>
                  {c.paymentMethodName ?? "결제수단 미지정"} ·{" "}
                  {c.actualPaidOn ?? `예정일 ${c.dueDate}`}
                </small>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={busy || editing !== null}
                onClick={() => void open(c)}
                aria-label={`${c.billingMonth ?? c.dueDate.slice(0, 7)} ${c.status === "COMPLETED" ? "결제 내역 수정" : "결제 내역 입력"}`}
              >
                {c.status === "COMPLETED" ? "수정" : "내역 입력"}
              </button>
            </li>
          ))}
      </ul>
      {editing && (
        <form
          ref={formRef}
          className={styles.paymentForm}
          onSubmit={save}
          aria-label={editing === "new" ? "결제 내역 입력" : "결제 내역 수정"}
          aria-busy={busy}
        >
          <h3>{editing === "new" ? "결제 내역 입력" : "결제 내역 수정"}</h3>
          <label>
            해당 월
            <input
              type="month"
              min="0001-01"
              max="9998-12"
              required
              value={month}
              disabled={
                busy || (editing !== "new" && editing.status === "PENDING")
              }
              onChange={(e) => {
                setMonth(e.target.value);
                changed();
              }}
            />
          </label>
          <label>
            결제 금액
            <WonInput
              digitsOnly
              required
              autoFocus
              value={value}
              disabled={busy}
              onValueChange={(v) => {
                setValue(v);
                changed();
              }}
            />
          </label>
          <label>
            실제 결제일
            <input
              type="date"
              min="0001-01-01"
              max="9998-12-31"
              required
              value={paidOn}
              disabled={busy}
              onChange={(e) => {
                setPaidOn(e.target.value);
                changed();
              }}
            />
          </label>
          <label>
            결제수단
            <select
              required
              value={method}
              disabled={busy}
              onChange={(e) => {
                setMethod(e.target.value);
                changed();
              }}
            >
              <option value="">결제수단 선택</option>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          {formError && (
            <p role="alert" className={styles.error}>
              {formError}
            </p>
          )}
          <div className={styles.chargeActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              취소
            </button>
            <button className={styles.primaryButton} disabled={busy}>
              {busy ? "저장 중…" : "결제 내역 저장"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
