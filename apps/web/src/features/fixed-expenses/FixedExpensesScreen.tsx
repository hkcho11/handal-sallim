"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/shared/ui/AppLink";
import { useAppRouter as useRouter } from "@/shared/ui/useAppRouter";
import WonInput from "../../shared/ui/WonInput";
import {
  updateFixedExpense,
  createFixedExpense,
  FixedExpenseApiError,
  getFixedExpenseFormOptions,
  type FixedExpense,
  type FixedExpenseFormOptions,
  type NewFixedExpense,
} from "./api";
import styles from "./fixed-expenses.module.css";

const INTERVALS = [
  { value: 1, label: "매월" },
  { value: 2, label: "격월" },
  { value: 3, label: "분기" },
  { value: 12, label: "매년" },
] as const;

type ExpenseField =
  | "category"
  | "subcategory"
  | "memo"
  | "amount"
  | "interval"
  | "recurringDay"
  | "date";
type ExpenseFieldErrors = Partial<Record<ExpenseField, string>>;

const EXPENSE_FIELD_ORDER: ExpenseField[] = [
  "category",
  "subcategory",
  "memo",
  "amount",
  "interval",
  "recurringDay",
  "date",
];

function messageOf(error: unknown): string {
  return error instanceof FixedExpenseApiError
    ? error.message
    : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}

function parseAmount(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isSafeInteger(amount) ? amount : null;
}

export default function FixedExpensesScreen({
  expense,
  onSaved,
}: {
  expense?: FixedExpense;
  onSaved?: (expense: FixedExpense) => void;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<FixedExpenseFormOptions>({
    payers: [],
    paymentMethods: [],
  });
  const [optionsError, setOptionsError] = useState("");
  const [memo, setMemo] = useState(
    expense?.memo ?? (expense && !expense.subcategoryId ? expense.name : ""),
  );
  const [subcategoryId, setSubcategoryId] = useState(
    expense?.subcategoryId ?? "",
  );
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [amount, setAmount] = useState(
    expense?.expectedAmount.toString() ?? "",
  );
  const [interval, setInterval] = useState(
    expense?.intervalMonths?.toString() ?? "",
  );
  const [recurringDay, setRecurringDay] = useState(
    expense?.recurringDayOfMonth?.toString() ?? "",
  );
  const [firstDueDate, setFirstDueDate] = useState(expense?.firstDueDate ?? "");
  const [payer, setPayer] = useState(expense?.payer ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(
    expense?.paymentMethodId ?? "",
  );
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const creationKey = useRef<string | null>(null);
  const fieldRefs = useRef<
    Record<ExpenseField, HTMLInputElement | HTMLSelectElement | null>
  >({
    memo: null,
    subcategory: null,
    amount: null,
    category: null,
    interval: null,
    recurringDay: null,
    date: null,
  });
  const [fieldErrors, setFieldErrors] = useState<ExpenseFieldErrors>({});
  const hasChanges =
    !expense ||
    categoryId !== (expense.categoryId ?? "") ||
    subcategoryId !== (expense.subcategoryId ?? "") ||
    memo !== (expense.memo ?? (!expense.subcategoryId ? expense.name : "")) ||
    amount !== expense.expectedAmount.toString() ||
    interval !== (expense.intervalMonths?.toString() ?? "") ||
    recurringDay !== (expense.recurringDayOfMonth?.toString() ?? "") ||
    firstDueDate !== (expense.firstDueDate ?? "") ||
    payer !== (expense.payer ?? "") ||
    paymentMethodId !== (expense.paymentMethodId ?? "");

  useEffect(() => {
    let active = true;
    getFixedExpenseFormOptions()
      .then((result) => {
        if (active) {
          setOptions(result);
          setOptionsError("");
        }
      })
      .catch((error: unknown) => {
        if (active) setOptionsError(messageOf(error));
      });
    return () => {
      active = false;
    };
  }, [optionsAttempt]);

  function resetCreationKey() {
    creationKey.current = null;
    setFormError("");
  }

  function clearFieldError(field: ExpenseField) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function showFieldErrors(errors: ExpenseFieldErrors) {
    setFieldErrors(errors);
    setFormError("");
    const firstInvalid = EXPENSE_FIELD_ORDER.find((field) => errors[field]);
    const element = firstInvalid ? fieldRefs.current[firstInvalid] : null;
    if (!element) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
    element.focus({ preventScroll: true });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const parsedAmount = parseAmount(amount);
    const parsedInterval = interval ? Number(interval) : null;
    const parsedRecurringDay = recurringDay ? Number(recurringDay) : null;
    const errors: ExpenseFieldErrors = {};
    if (!categoryId) errors.category = "대분류를 선택해 주세요.";
    if (
      !subcategoryId ||
      !(options.subcategories ?? []).some(
        (item) => item.id === subcategoryId && item.categoryId === categoryId,
      )
    )
      errors.subcategory = "선택한 대분류의 중분류를 선택해 주세요.";
    if (memo.trim().length > 120)
      errors.memo = "메모는 120자 이내로 입력해 주세요.";
    if (parsedAmount === null)
      errors.amount = "1원 이상의 금액을 숫자로 입력해 주세요.";
    if (parsedInterval !== null && ![1, 2, 3, 12].includes(parsedInterval)) {
      errors.interval = "목록에서 반복주기를 선택해 주세요.";
    }
    if (
      recurringDay &&
      (!Number.isInteger(parsedRecurringDay) ||
        parsedRecurringDay! < 1 ||
        parsedRecurringDay! > 31)
    ) {
      errors.recurringDay = "반복 결제일은 1일부터 31일 사이로 입력해 주세요.";
    }
    if (firstDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) {
      errors.date = "올바른 첫 결제일을 입력해 주세요.";
    }
    const invalidPayer = payer !== "" && !["ME", "PARTNER"].includes(payer);
    if (Object.keys(errors).length > 0 || invalidPayer) {
      showFieldErrors(errors);
      if (invalidPayer) setFormError("결제자 정보를 확인해 주세요.");
      return;
    }
    setFieldErrors({});
    const input: NewFixedExpense = {
      memo: memo.trim() || null,
      subcategoryId,
      expectedAmount: parsedAmount as number,
      intervalMonths: parsedInterval as NewFixedExpense["intervalMonths"],
      recurringDayOfMonth: parsedRecurringDay,
      firstDueDate: firstDueDate || null,
      payer: (payer || null) as NewFixedExpense["payer"],
      paymentMethodId: paymentMethodId || null,
      categoryId,
    };
    creationKey.current ??= crypto.randomUUID();
    setIsSaving(true);
    setFormError("");
    try {
      const saved = expense
        ? await updateFixedExpense(expense.id, input)
        : await createFixedExpense(input, creationKey.current);
      creationKey.current = null;
      if (onSaved) onSaved(saved);
      else router.push(`/fixed-costs/${saved.id}`);
    } catch (error) {
      setFormError(messageOf(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href={expense ? `/fixed-costs/${expense.id}` : "/fixed-costs"}
          className={styles.back}
          onClick={
            expense && onSaved
              ? (event) => {
                  event.preventDefault();
                  onSaved(expense);
                }
              : undefined
          }
        >
          ← {expense ? "상세로 돌아가기" : "고정비 목록"}
        </Link>
        <h1>{expense ? "정보 수정" : "내역 추가"}</h1>
        <p>
          {expense
            ? "고정비의 결제 정보와 일정을 수정하세요."
            : "고정비의 결제 정보와 일정을 등록하세요."}
        </p>
      </header>
      <section
        className={`${styles.panel} ${styles.formPanel}`}
        aria-labelledby="add-heading"
      >
        <h2 id="add-heading">
          {expense ? (expense.subcategoryName ?? expense.name) : "고정비"}
        </h2>
        <p className={styles.muted}>
          대분류, 중분류와 금액은 필수이고 메모는 선택입니다. 일정이 모두
          정해지면 예정 청구를 만들어요.
        </p>
        {expense && (
          <p className={styles.fieldHint}>
            수정 내용은 반복 설정과 미완료 예정 청구에 반영되며, 완료 기록은
            유지됩니다.
          </p>
        )}
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <label htmlFor="expense-category">대분류</label>
          <select
            id="expense-category"
            value={categoryId}
            disabled={isSaving}
            ref={(element) => {
              fieldRefs.current.category = element;
            }}
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.category)}
            aria-describedby={
              fieldErrors.category ? "expense-category-error" : undefined
            }
            onChange={(event) => {
              setCategoryId(event.target.value);
              setSubcategoryId("");
              clearFieldError("category");
              clearFieldError("subcategory");
              resetCreationKey();
            }}
          >
            <option value="">선택해 주세요</option>
            {(options.categories ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {fieldErrors.category && (
            <p
              id="expense-category-error"
              role="alert"
              className={styles.fieldError}
            >
              {fieldErrors.category}
            </p>
          )}

          <label htmlFor="expense-subcategory">중분류</label>
          <select
            id="expense-subcategory"
            value={subcategoryId}
            disabled={isSaving || !categoryId}
            ref={(element) => {
              fieldRefs.current.subcategory = element;
            }}
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.subcategory)}
            aria-describedby={
              fieldErrors.subcategory ? "expense-subcategory-error" : undefined
            }
            onChange={(event) => {
              setSubcategoryId(event.target.value);
              clearFieldError("subcategory");
              resetCreationKey();
            }}
          >
            <option value="">
              {categoryId ? "선택해 주세요" : "대분류를 먼저 선택해 주세요"}
            </option>
            {(options.subcategories ?? [])
              .filter((item) => item.categoryId === categoryId)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
          {fieldErrors.subcategory && (
            <p
              id="expense-subcategory-error"
              role="alert"
              className={styles.fieldError}
            >
              {fieldErrors.subcategory}
            </p>
          )}
          <p className={styles.fieldHint}>
            필요한 분류는 <Link href="/settings/categories">분류 설정</Link>에서
            추가할 수 있어요.
          </p>
          {optionsError && (
            <div role="alert" className={styles.error}>
              <p>{optionsError}</p>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setOptionsAttempt((value) => value + 1)}
              >
                선택지 다시 불러오기
              </button>
            </div>
          )}

          <label htmlFor="expense-memo">메모 (선택)</label>
          <input
            id="expense-memo"
            value={memo}
            maxLength={120}
            disabled={isSaving}
            ref={(element) => {
              fieldRefs.current.memo = element;
            }}
            aria-invalid={Boolean(fieldErrors.memo)}
            aria-describedby="expense-memo-hint"
            onChange={(event) => {
              setMemo(event.target.value);
              clearFieldError("memo");
              resetCreationKey();
            }}
            placeholder="예: 넷플릭스, 내 휴대폰"
          />
          <p id="expense-memo-hint" className={styles.fieldHint}>
            비워두면 중분류명으로 표시해요.
          </p>
          {fieldErrors.memo && (
            <p role="alert" className={styles.fieldError}>
              {fieldErrors.memo}
            </p>
          )}

          <label htmlFor="expense-amount">금액 (원)</label>
          <WonInput
            id="expense-amount"
            ref={(element) => {
              fieldRefs.current.amount = element;
            }}
            disabled={isSaving}
            value={amount}
            onValueChange={(value) => {
              setAmount(value);
              resetCreationKey();
              clearFieldError("amount");
            }}
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.amount)}
            aria-describedby={
              fieldErrors.amount ? "expense-amount-error" : undefined
            }
            placeholder="650,000"
          />
          {fieldErrors.amount && (
            <p
              id="expense-amount-error"
              role="alert"
              className={styles.fieldError}
            >
              {fieldErrors.amount}
            </p>
          )}

          <label htmlFor="expense-interval">반복주기</label>
          <select
            id="expense-interval"
            data-align="center"
            ref={(element) => {
              fieldRefs.current.interval = element;
            }}
            disabled={isSaving}
            value={interval}
            onChange={(event) => {
              setInterval(event.target.value);
              resetCreationKey();
              clearFieldError("interval");
            }}
            aria-invalid={Boolean(fieldErrors.interval)}
            aria-describedby={
              fieldErrors.interval ? "expense-interval-error" : undefined
            }
          >
            <option value="">-</option>
            {INTERVALS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {fieldErrors.interval && (
            <p
              id="expense-interval-error"
              role="alert"
              className={styles.fieldError}
            >
              {fieldErrors.interval}
            </p>
          )}

          <label htmlFor="expense-recurring-day">반복 결제일</label>
          <input
            id="expense-recurring-day"
            ref={(element) => {
              fieldRefs.current.recurringDay = element;
            }}
            type="number"
            min={1}
            max={31}
            step={1}
            inputMode="numeric"
            disabled={isSaving}
            value={recurringDay}
            placeholder="1~31"
            aria-invalid={Boolean(fieldErrors.recurringDay)}
            aria-describedby={`expense-recurring-day-hint${fieldErrors.recurringDay ? " expense-recurring-day-error" : ""}`}
            onChange={(event) => {
              setRecurringDay(event.target.value);
              resetCreationKey();
              clearFieldError("recurringDay");
            }}
          />
          <p id="expense-recurring-day-hint" className={styles.fieldHint}>
            첫 결제일과 별도로, 이후 회차에 적용할 날짜입니다.
          </p>
          {fieldErrors.recurringDay && (
            <p
              id="expense-recurring-day-error"
              role="alert"
              className={styles.fieldError}
            >
              {fieldErrors.recurringDay}
            </p>
          )}

          {options.payers.length > 0 && (
            <>
              <label htmlFor="expense-payer">결제자</label>
              <select
                id="expense-payer"
                data-align="center"
                disabled={isSaving}
                value={payer}
                onChange={(event) => {
                  setPayer(event.target.value);
                  resetCreationKey();
                }}
              >
                <option value="">-</option>
                {options.payers.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </>
          )}

          <label htmlFor="expense-payment-method">결제수단</label>
          <select
            id="expense-payment-method"
            disabled={isSaving}
            value={paymentMethodId}
            onChange={(event) => {
              setPaymentMethodId(event.target.value);
              resetCreationKey();
            }}
          >
            <option value="">-</option>
            {options.paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name} ({paymentMethodType(method.type)})
              </option>
            ))}
          </select>

          <label htmlFor="expense-date">첫 결제일</label>
          <input
            id="expense-date"
            ref={(element) => {
              fieldRefs.current.date = element;
            }}
            disabled={isSaving}
            type="date"
            value={firstDueDate}
            onChange={(event) => {
              setFirstDueDate(event.target.value);
              if (event.target.value && !recurringDay) {
                setRecurringDay(String(Number(event.target.value.slice(8))));
              }
              resetCreationKey();
              clearFieldError("date");
            }}
            aria-invalid={Boolean(fieldErrors.date)}
            aria-describedby={
              fieldErrors.date ? "expense-date-error" : undefined
            }
          />
          {fieldErrors.date && (
            <p
              id="expense-date-error"
              role="alert"
              className={styles.fieldError}
            >
              {fieldErrors.date}
            </p>
          )}

          {formError && (
            <p role="alert" className={styles.error}>
              {formError}
            </p>
          )}
          <button type="submit" disabled={isSaving || !hasChanges}>
            {isSaving ? "저장 중…" : expense ? "정보 저장" : "고정비 저장"}
          </button>
        </form>
      </section>
    </main>
  );
}

function paymentMethodType(type: "CARD" | "ACCOUNT" | "CASH") {
  if (type === "CARD") return "카드";
  if (type === "ACCOUNT") return "계좌";
  return "현금";
}
