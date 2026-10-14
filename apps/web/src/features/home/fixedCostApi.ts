import type { FixedCostDashboard } from "./fixedCostStatistics";
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const nullableText = (value: unknown) => value === null || text(value);
const amount = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const month = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const date = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf()) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export function validFixedCostDashboard(
  value: unknown,
): value is FixedCostDashboard {
  if (
    !object(value) ||
    !month(value.month) ||
    !date(value.asOf) ||
    !Array.isArray(value.months) ||
    value.months.length !== 6 ||
    !value.months.every(month) ||
    value.months[5] !== value.month ||
    !Array.isArray(value.charges) ||
    !Array.isArray(value.classifications) ||
    !Array.isArray(value.unscheduled)
  )
    return false;
  const months = value.months;
  const end = new Date(`${value.month}-01T00:00:00Z`);
  if (
    !months.every((item, index) => {
      const target = new Date(end);
      target.setUTCMonth(target.getUTCMonth() - 5 + index);
      return target.toISOString().slice(0, 7) === item;
    })
  )
    return false;
  if (
    !value.charges.every(
      (charge) =>
        object(charge) &&
        text(charge.id) &&
        text(charge.recurringExpenseId) &&
        text(charge.name) &&
        date(charge.dueDate) &&
        months.includes(charge.dueDate.slice(0, 7)) &&
        amount(charge.expectedAmount) &&
        Number(charge.expectedAmount) > 0 &&
        ["예정", "지연", "완료"].includes(String(charge.status)) &&
        nullableText(charge.categoryId) &&
        nullableText(charge.categoryName) &&
        nullableText(charge.subcategoryId) &&
        nullableText(charge.subcategoryName) &&
        (charge.subcategoryId === null || charge.categoryId !== null) &&
        nullableText(charge.plannedPaymentMethodId) &&
        nullableText(charge.paymentMethod) &&
        nullableText(charge.actualPaymentMethodId) &&
        nullableText(charge.actualPaymentMethod) &&
        (charge.status === "완료"
          ? amount(charge.actualAmount) &&
            Number(charge.actualAmount) > 0 &&
            text(charge.actualPaymentMethodId) &&
            text(charge.actualPaymentMethod) &&
            date(charge.actualPaidOn)
          : charge.actualAmount === null &&
            charge.actualPaymentMethodId === null &&
            charge.actualPaymentMethod === null &&
            charge.actualPaidOn === null),
    )
  )
    return false;
  if (
    !value.classifications.every(
      (c) =>
        object(c) &&
        text(c.categoryId) &&
        text(c.categoryName) &&
        text(c.subcategoryId) &&
        text(c.subcategoryName),
    ) ||
    !value.unscheduled.every(
      (item) =>
        object(item) &&
        text(item.id) &&
        text(item.name) &&
        amount(item.expectedAmount) &&
        Number(item.expectedAmount) > 0,
    )
  )
    return false;
  if (
    new Set(value.charges.map((charge) => charge.id)).size !==
    value.charges.length
  )
    return false;
  return (
    Number.isSafeInteger(
      value.charges.reduce(
        (sum, charge) =>
          sum +
          Number(charge.expectedAmount) +
          Number(charge.actualAmount ?? 0),
        0,
      ),
    ) &&
    Number.isSafeInteger(
      value.unscheduled.reduce(
        (sum, item) => sum + Number(item.expectedAmount),
        0,
      ),
    )
  );
}
export async function getFixedCostDashboard(
  selectedMonth?: string,
): Promise<FixedCostDashboard> {
  const response = await fetch(
    `/backend/dashboard/fixed-costs${selectedMonth ? `?month=${encodeURIComponent(selectedMonth)}` : ""}`,
    { cache: "no-store", credentials: "same-origin" },
  );
  if (!response.ok) throw new Error("고정비 통계를 불러오지 못했습니다.");
  const value: unknown = await response.json();
  if (!validFixedCostDashboard(value))
    throw new Error("고정비 통계 응답을 확인할 수 없습니다.");
  return value;
}
