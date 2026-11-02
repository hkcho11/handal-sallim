import { apiFetch } from "../../shared/api/apiFetch";
import { hasOwner } from "../../shared/api/owners";
import { SERVICE_UNAVAILABLE_MESSAGE } from "../../shared/api/serviceAvailability";

export interface Income {
  id: string;
  name: string;
  amount: number;
  month: string;
  version: number;
  ownerUserId: string;
  ownerName: string;
}
export interface IncomeMonth {
  month: string;
  totalAmount: string;
  items: Income[];
}
export type IncomeInput = Pick<
  Income,
  "name" | "amount" | "month" | "ownerUserId"
>;
export function validMonth(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/.test(value)
  );
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function income(value: unknown): value is Income {
  return (
    object(value) &&
    hasOwner(value) &&
    typeof value.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.id,
    ) &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    value.name.length <= 120 &&
    typeof value.amount === "number" &&
    Number.isSafeInteger(value.amount) &&
    value.amount > 0 &&
    validMonth(value.month) &&
    typeof value.version === "number" &&
    Number.isSafeInteger(value.version) &&
    value.version >= 0
  );
}
async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await apiFetch(`/backend/incomes${path}`, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new Error("연결할 수 없습니다. 다시 시도해 주세요.");
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      503: SERVICE_UNAVAILABLE_MESSAGE,
      400: "소유자·수입명·금액·해당 월을 확인해 주세요.",
      401: "로그인이 필요합니다.",
      403: "사용할 수 있는 공간이 없습니다.",
      404: "수입을 찾을 수 없습니다. 목록을 새로고침해 주세요.",
      409: "내역이 변경되었습니다. 입력 내용을 확인하고 목록을 새로고침해 주세요.",
    };
    throw new Error(
      messages[response.status] ??
        "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
    );
  }
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new Error("수입 응답을 확인할 수 없습니다.");
  }
}
export async function listIncomes(month: string): Promise<IncomeMonth> {
  const result = await request(`?month=${encodeURIComponent(month)}`);
  if (
    !object(result) ||
    result.month !== month ||
    typeof result.totalAmount !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(result.totalAmount) ||
    !Array.isArray(result.items) ||
    !result.items.every(income) ||
    result.items.some((item) => item.month !== month) ||
    new Set(result.items.map((item) => item.id)).size !== result.items.length ||
    result.items
      .reduce((total, item) => total + BigInt(item.amount), BigInt(0))
      .toString() !== result.totalAmount
  )
    throw new Error("수입 응답을 확인할 수 없습니다.");
  return { month, totalAmount: result.totalAmount, items: result.items };
}
export async function getIncome(id: string): Promise<Income> {
  const result = await request(`/${encodeURIComponent(id)}`);
  if (!income(result) || result.id !== id)
    throw new Error("수입 응답을 확인할 수 없습니다.");
  return result;
}

export async function saveIncome(
  input: IncomeInput,
  key: string,
  current?: Income,
): Promise<Income> {
  const result = await request(current ? `/${current.id}` : "", {
    method: current ? "PUT" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(current ? {} : { "Idempotency-Key": key }),
    },
    body: JSON.stringify({
      ...input,
      ...(current ? { version: current.version } : {}),
    }),
  });
  if (
    !income(result) ||
    (current && result.id !== current.id) ||
    result.name !== input.name.trim() ||
    result.ownerUserId !== input.ownerUserId ||
    result.amount !== input.amount ||
    result.month !== input.month
  )
    throw new Error("저장 응답을 확인할 수 없습니다.");
  return result;
}
export async function deleteIncome(item: Income): Promise<void> {
  await request(`/${item.id}?version=${item.version}`, { method: "DELETE" });
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}
