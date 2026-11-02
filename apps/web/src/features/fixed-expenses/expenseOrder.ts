import type { FixedExpense } from "./api";

type ExpenseTiming = Pick<
  FixedExpense,
  "firstChargeDueDate" | "firstDueDate" | "firstChargeStatus"
>;

export function paymentDate(expense: ExpenseTiming) {
  return expense.firstChargeDueDate === undefined
    ? expense.firstDueDate
    : expense.firstChargeDueDate;
}

const priority = { OVERDUE: 0, PENDING: 1, COMPLETED: 2 };

export function compareFixedExpenses(a: ExpenseTiming, b: ExpenseTiming) {
  const statusOrder =
    (a.firstChargeStatus ? priority[a.firstChargeStatus] : 3) -
    (b.firstChargeStatus ? priority[b.firstChargeStatus] : 3);
  return (
    statusOrder ||
    (paymentDate(a) ?? "9999-12-31").localeCompare(
      paymentDate(b) ?? "9999-12-31",
    )
  );
}

export function overdueStatus(expense: ExpenseTiming, today: string) {
  const dueDate = paymentDate(expense);
  if (!dueDate) return "지연";
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) /
      86400000,
  );
  return days > 0 ? `지연 · D+${days}` : "지연";
}

export function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
