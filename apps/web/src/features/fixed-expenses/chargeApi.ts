import { apiFetch } from "../../shared/api/apiFetch";
import { initializeCsrf } from "../auth/api";

export interface ScheduledCharge {
  billingMonth?: string;
  id: string;
  recurringExpenseId: string;
  name: string;
  dueDate: string;
  expectedAmount: number | null;
  status: "PENDING" | "COMPLETED";
  actualAmount: number | null;
  actualPaidOn: string | null;
  plannedPaymentMethodId: string | null;
  actualPaymentMethodId: string | null;
  paymentMethodName: string | null;
  version: number;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const date = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf()) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const amount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
export function parseCharge(value: unknown): ScheduledCharge {
  if (
    !object(value) ||
    !uuid(value.id) ||
    !uuid(value.recurringExpenseId) ||
    typeof value.name !== "string" ||
    !date(value.dueDate) ||
    (value.billingMonth !== undefined &&
      (typeof value.billingMonth !== "string" ||
        !date(`${value.billingMonth}-01`))) ||
    (value.expectedAmount !== null && !amount(value.expectedAmount)) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 0 ||
    !["PENDING", "COMPLETED"].includes(String(value.status)) ||
    (value.plannedPaymentMethodId !== null &&
      !uuid(value.plannedPaymentMethodId)) ||
    (value.actualPaymentMethodId !== null &&
      !uuid(value.actualPaymentMethodId)) ||
    (value.paymentMethodName !== null &&
      typeof value.paymentMethodName !== "string") ||
    (value.status === "COMPLETED"
      ? !amount(value.actualAmount) ||
        !date(value.actualPaidOn) ||
        !uuid(value.actualPaymentMethodId)
      : value.actualAmount !== null ||
        value.actualPaidOn !== null ||
        value.actualPaymentMethodId !== null)
  )
    throw new Error(
      "결제 내역 응답을 확인하지 못했습니다. 다시 불러와 주세요.",
    );
  return value as unknown as ScheduledCharge;
}
async function request(
  path: string,
  input?: Record<string, unknown>,
  key?: string,
): Promise<unknown> {
  if (input) await initializeCsrf();
  let response: Response;
  try {
    response = await apiFetch(`/backend/${path}`, {
      method: input ? "POST" : "GET",
      cache: "no-store",
      headers: input
        ? {
            "Content-Type": "application/json",
            ...(key ? { "Idempotency-Key": key } : {}),
          }
        : undefined,
      body: input ? JSON.stringify(input) : undefined,
    });
  } catch {
    throw new Error(
      "서버에 연결하지 못했습니다. 입력을 유지했으니 다시 시도해 주세요.",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "결제 응답을 확인하지 못했습니다. 상태를 다시 확인해 주세요.",
    );
  }
  if (!response.ok)
    throw new Error(
      object(data) && typeof data.message === "string"
        ? data.message
        : "결제를 처리하지 못했습니다. 다시 확인해 주세요.",
    );
  return data;
}
export async function loadCharges(expense: string): Promise<ScheduledCharge[]> {
  const data = await request(
    `recurring-expenses/${encodeURIComponent(expense)}/charges`,
  );
  if (!Array.isArray(data)) throw new Error("결제 내역을 불러오지 못했습니다.");
  return data.map(parseCharge);
}
export async function completeCharge(
  id: string,
  input: {
    amount: number;
    paidOn: string;
    paymentMethodId: string;
    version: number;
  },
) {
  return parseCharge(
    await request(
      `scheduled-charges/${encodeURIComponent(id)}/complete`,
      input,
    ),
  );
}

export interface PaymentInput extends Record<string, unknown> {
  billingMonth: string;
  amount: number;
  paidOn: string;
  paymentMethodId: string;
  version: number;
}
export async function recordPayment(
  expense: string,
  input: PaymentInput,
  key: string,
) {
  return parseCharge(
    await request(
      `recurring-expenses/${encodeURIComponent(expense)}/payments`,
      input,
      key,
    ),
  );
}
export async function editPayment(id: string, input: PaymentInput) {
  return parseCharge(
    await request(`scheduled-charges/${encodeURIComponent(id)}/edit`, input),
  );
}
