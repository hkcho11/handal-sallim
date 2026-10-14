"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  errorMessage,
  isDate,
  personalExpenseOptions,
  savePersonalExpense,
  PersonalExpenseApiError,
  type PersonalExpense,
  type PersonalExpenseOptions,
  type PersonalExpenseInput,
} from "./api";
import styles from "./personal-expenses.module.css";

type Field =
  | "name"
  | "amount"
  | "occurredOn"
  | "categoryId"
  | "paymentMethodId"
  | "memo"
  | "privateConfirmed";
const fields: Field[] = [
  "name",
  "amount",
  "occurredOn",
  "categoryId",
  "paymentMethodId",
  "memo",
  "privateConfirmed",
];

export default function PersonalExpenseForm({
  current,
  initialDate,
  onSaved,
  onCancel,
}: {
  current?: PersonalExpense;
  initialDate: string;
  onSaved?: (expense: PersonalExpense) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<PersonalExpenseOptions | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [retry, setRetry] = useState(0);
  const [name, setName] = useState(current?.name ?? "");
  const [amount, setAmount] = useState(current?.amount.toString() ?? "");
  const [date, setDate] = useState(current?.occurredOn ?? initialDate);
  const [category, setCategory] = useState(current?.categoryId ?? "");
  const [method, setMethod] = useState(current?.paymentMethodId ?? "");
  const [memo, setMemo] = useState(current?.memo ?? "");
  const [privateConfirmed, setPrivateConfirmed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const creationKey = useRef<string | null>(null);
  const lastPayload = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    personalExpenseOptions()
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch((failure: unknown) => {
        if (active) setOptionsError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [retry]);

  function clear(field: Field) {
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !options) return;
    const form = event.currentTarget;
    const next: Partial<Record<Field, string>> = {};
    if (!name.trim() || name.trim().length > 120)
      next.name = "지출명을 120자 이내로 입력해 주세요.";
    if (!/^[1-9]\d*$/.test(amount) || !Number.isSafeInteger(Number(amount)))
      next.amount = "금액은 원 단위 양수로 입력해 주세요.";
    if (!isDate(date)) next.occurredOn = "날짜를 입력해 주세요.";
    if (!category) next.categoryId = "카테고리를 선택해 주세요.";
    if (!method) next.paymentMethodId = "결제수단을 선택해 주세요.";
    if (memo.length > 500) next.memo = "메모는 500자 이내로 입력해 주세요.";
    if (!current && options.sharedSpace && !privateConfirmed)
      next.privateConfirmed = "개인 지출로 등록할지 확인해 주세요.";
    setErrors(next);
    setError("");
    const first = fields.find((field) => next[field]);
    if (first) {
      const element = form.elements.namedItem(first);
      if (element instanceof HTMLElement) {
        element.scrollIntoView({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        });
        element.focus({ preventScroll: true });
      }
      return;
    }
    const input: PersonalExpenseInput = {
      name: name.trim(),
      amount: Number(amount),
      occurredOn: date,
      categoryId: category,
      paymentMethodId: method,
      memo: memo.trim() || null,
      privateConfirmed,
    };
    const serialized = JSON.stringify(input);
    if (serialized !== lastPayload.current) {
      creationKey.current = crypto.randomUUID();
      lastPayload.current = serialized;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const saved = await savePersonalExpense(
        input,
        creationKey.current!,
        current,
      );
      if (onSaved) onSaved(saved);
      else router.push(`/personal-expenses/${saved.id}`);
    } catch (failure) {
      setError(errorMessage(failure));
      setConflict(
        failure instanceof PersonalExpenseApiError && failure.status === 409,
      );
      setBusy(false);
    } finally {
      submitting.current = false;
    }
  }
  function fieldProps(field: Field) {
    return {
      name: field,
      id: `expense-${field}`,
      "aria-invalid": !!errors[field],
      "aria-describedby": errors[field] ? `error-${field}` : undefined,
      "aria-label": {
        name: "지출명",
        amount: "금액 (원)",
        occurredOn: "날짜",
        categoryId: "카테고리",
        paymentMethodId: "결제수단",
        memo: "메모 (선택)",
        privateConfirmed: "본인만 보는 개인 지출로 등록합니다.",
      }[field],
    };
  }
  function fieldError(field: Field) {
    return errors[field] ? (
      <p className={styles.fieldError} id={`error-${field}`}>
        {errors[field]}
      </p>
    ) : null;
  }
  const categories = options?.categories ?? [];
  const methods = options?.paymentMethods ?? [];
  return (
    <main className={styles.page}>
      <div className={`${styles.container} ${styles.formContainer}`}>
        <header className={styles.header}>
          <div>
            <Link
              href={
                current
                  ? `/personal-expenses/${current.id}`
                  : "/personal-expenses"
              }
              className={styles.back}
              onClick={
                current && onCancel
                  ? (event) => {
                      event.preventDefault();
                      onCancel();
                    }
                  : undefined
              }
            >
              ← {current ? "지출 상세" : "개인 지출 목록"}
            </Link>
            <h1>{current ? "지출 수정" : "개인 지출 추가"}</h1>
          </div>
        </header>
        <section className={styles.panel} aria-label="지출 입력">
          {!options && !optionsError && (
            <p role="status">입력 정보를 불러오는 중…</p>
          )}
          {optionsError && (
            <div role="alert" className={styles.error}>
              <p>{optionsError}</p>
              <button
                type="button"
                onClick={() => {
                  setOptionsError("");
                  setRetry((value) => value + 1);
                }}
              >
                다시 시도
              </button>
            </div>
          )}
          {options && (
            <form noValidate onSubmit={(event) => void submit(event)}>
              <fieldset disabled={busy} className={styles.fields}>
                <label htmlFor="expense-name">
                  지출명
                  <input
                    {...fieldProps("name")}
                    value={name}
                    maxLength={120}
                    onChange={(event) => {
                      setName(event.target.value);
                      clear("name");
                    }}
                    required
                  />
                  {fieldError("name")}
                </label>
                <label htmlFor="expense-amount">
                  금액 (원)
                  <input
                    {...fieldProps("amount")}
                    inputMode="numeric"
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      clear("amount");
                    }}
                    required
                  />
                  {fieldError("amount")}
                </label>
                <label htmlFor="expense-occurredOn">
                  날짜
                  <input
                    {...fieldProps("occurredOn")}
                    type="date"
                    min="0001-01-01"
                    max="9999-12-31"
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      clear("occurredOn");
                    }}
                    required
                  />
                  {fieldError("occurredOn")}
                </label>
                <label htmlFor="expense-categoryId">
                  카테고리
                  <select
                    {...fieldProps("categoryId")}
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      clear("categoryId");
                    }}
                    required
                  >
                    <option value="">선택해 주세요</option>
                    {current &&
                      !categories.some(
                        (item) => item.id === current.categoryId,
                      ) && (
                        <option value={current.categoryId}>
                          {current.categoryName} (보관됨)
                        </option>
                      )}
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {fieldError("categoryId")}
                </label>
                <label htmlFor="expense-paymentMethodId">
                  결제수단
                  <select
                    {...fieldProps("paymentMethodId")}
                    value={method}
                    onChange={(event) => {
                      setMethod(event.target.value);
                      clear("paymentMethodId");
                    }}
                    required
                  >
                    <option value="">선택해 주세요</option>
                    {current &&
                      !methods.some(
                        (item) => item.id === current.paymentMethodId,
                      ) && (
                        <option value={current.paymentMethodId}>
                          {current.paymentMethodName} (보관됨)
                        </option>
                      )}
                    {methods.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {fieldError("paymentMethodId")}
                </label>
                {(!categories.length || !methods.length) && !current && (
                  <p className={styles.intro}>
                    등록에 사용할 카테고리와 결제수단이 필요합니다. 공간의
                    설정을 확인해 주세요.
                  </p>
                )}
                <label htmlFor="expense-memo">
                  메모 (선택)
                  <textarea
                    {...fieldProps("memo")}
                    value={memo}
                    maxLength={500}
                    rows={3}
                    onChange={(event) => {
                      setMemo(event.target.value);
                      clear("memo");
                    }}
                  />
                  {fieldError("memo")}
                </label>
                {!current && options.sharedSpace && (
                  <label
                    className={styles.checkbox}
                    htmlFor="expense-privateConfirmed"
                  >
                    <input
                      {...fieldProps("privateConfirmed")}
                      type="checkbox"
                      checked={privateConfirmed}
                      onChange={(event) => {
                        setPrivateConfirmed(event.target.checked);
                        clear("privateConfirmed");
                      }}
                    />
                    본인만 보는 개인 지출로 등록합니다.
                    {fieldError("privateConfirmed")}
                  </label>
                )}
                {conflict && current && (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                  >
                    최신 내역 다시 불러오기
                  </button>
                )}
                {error && (
                  <p role="alert" className={styles.error}>
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className={styles.primary}
                  disabled={
                    busy ||
                    (!current && (!categories.length || !methods.length))
                  }
                >
                  {busy ? "저장 중…" : current ? "수정 저장" : "지출 저장"}
                </button>
              </fieldset>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
