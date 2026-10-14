import type { DashboardResponse } from "./dashboard";

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const amount = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const date = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf()) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const nullableText = (value: unknown) =>
  value === null || typeof value === "string";

function valid(value: unknown): value is DashboardResponse {
  if (
    !object(value) ||
    typeof value.month !== "string" ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.month) ||
    !date(value.asOf) ||
    !Array.isArray(value.entries) ||
    !Array.isArray(value.charges)
  )
    return false;
  const month = value.month;
  return (
    value.entries.every(
      (entry) =>
        object(entry) &&
        typeof entry.id === "string" &&
        typeof entry.name === "string" &&
        date(entry.date) &&
        entry.date.startsWith(`${month}-`) &&
        amount(entry.amount) &&
        typeof entry.category === "string" &&
        entry.scope === "공동" &&
        typeof entry.paymentMethod === "string",
    ) &&
    value.charges.every(
      (charge) =>
        object(charge) &&
        typeof charge.id === "string" &&
        typeof charge.name === "string" &&
        date(charge.dueDate) &&
        charge.dueDate.startsWith(`${month}-`) &&
        charge.dueDay === Number(charge.dueDate.slice(-2)) &&
        amount(charge.expectedAmount) &&
        (charge.actualAmount === null || amount(charge.actualAmount)) &&
        nullableText(charge.payer) &&
        nullableText(charge.paymentMethod) &&
        ["예정", "지연", "완료"].includes(String(charge.status)),
    )
  );
}

export async function getDashboard(): Promise<DashboardResponse> {
  const response = await fetch("/backend/dashboard", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "로그인이 필요합니다."
        : "생활비를 불러오지 못했습니다.",
    );
  const data: unknown = await response.json();
  if (!valid(data)) throw new Error("생활비 응답을 확인할 수 없습니다.");
  const total =
    data.entries.reduce((sum, entry) => sum + entry.amount, 0) +
    data.charges
      .filter((charge) => charge.status !== "완료")
      .reduce((sum, charge) => sum + charge.expectedAmount, 0);
  if (!Number.isSafeInteger(total))
    throw new Error("금액 합계를 표시할 수 없습니다.");
  return data;
}
