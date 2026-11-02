import { cachedRead } from "../../shared/api/readCache";
import { apiFetch } from "../../shared/api/apiFetch";
import { hasOwner } from "../../shared/api/owners";
import { SERVICE_UNAVAILABLE_MESSAGE } from "../../shared/api/serviceAvailability";

export interface Savings {
  id: string;
  name: string;
  type: "DEPOSIT" | "INSTALLMENT";
  depositAmount: number;
  currentAmount: number;
  version: number;
  ownerUserId: string;
  ownerName: string;
}
export interface SavingsOverview {
  totalCurrentAmount: string;
  monthlyDepositAmount: string;
  items: Savings[];
}
export type SavingsInput = Omit<Savings, "id" | "version" | "ownerName">;
export const typeLabels = { DEPOSIT: "예금", INSTALLMENT: "적금" };
export function money(value: string | number) {
  return BigInt(value).toLocaleString("ko-KR") + "원";
}
export function depositLabel(type: Savings["type"]) {
  return type === "DEPOSIT" ? "예치 금액" : "월 납입액";
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function integer(value: unknown, minimum: number): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= minimum
  );
}
function savings(value: unknown): value is Savings {
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
    (value.type === "DEPOSIT" || value.type === "INSTALLMENT") &&
    integer(value.depositAmount, 1) &&
    integer(value.currentAmount, 0) &&
    integer(value.version, 0)
  );
}
async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await apiFetch(`/backend/savings${path}`, {
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
      400: "소유자·저축명·종류·금액을 확인해 주세요.",
      401: "로그인이 필요합니다.",
      403: "사용할 수 있는 공간이 없습니다.",
      404: "저축을 찾을 수 없습니다. 목록을 새로고침해 주세요.",
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
    throw new Error("저축 응답을 확인할 수 없습니다.");
  }
}

export function listSavings(fresh = false): Promise<SavingsOverview> {
  return cachedRead("savings:list", fetchSavings, fresh);
}
async function fetchSavings(): Promise<SavingsOverview> {
  const result = await request("");
  if (
    !object(result) ||
    typeof result.totalCurrentAmount !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(result.totalCurrentAmount) ||
    typeof result.monthlyDepositAmount !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(result.monthlyDepositAmount) ||
    !Array.isArray(result.items) ||
    !result.items.every(savings) ||
    new Set(result.items.map((i) => i.id)).size !== result.items.length ||
    result.items
      .reduce((sum, i) => sum + BigInt(i.currentAmount), BigInt(0))
      .toString() !== result.totalCurrentAmount ||
    result.items
      .filter((i) => i.type === "INSTALLMENT")
      .reduce((sum, i) => sum + BigInt(i.depositAmount), BigInt(0))
      .toString() !== result.monthlyDepositAmount
  )
    throw new Error("저축 응답을 확인할 수 없습니다.");
  return {
    totalCurrentAmount: result.totalCurrentAmount,
    monthlyDepositAmount: result.monthlyDepositAmount,
    items: result.items,
  };
}
export async function getSavings(id: string): Promise<Savings> {
  const result = await request(`/${encodeURIComponent(id)}`);
  if (!savings(result) || result.id !== id)
    throw new Error("저축 응답을 확인할 수 없습니다.");
  return result;
}
export async function saveSavings(
  input: SavingsInput,
  key: string,
  current?: Savings,
): Promise<Savings> {
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
    !savings(result) ||
    (current && result.id !== current.id) ||
    result.name !== input.name.trim() ||
    result.ownerUserId !== input.ownerUserId ||
    result.type !== input.type ||
    result.depositAmount !== input.depositAmount ||
    result.currentAmount !== input.currentAmount
  )
    throw new Error("저장 응답을 확인할 수 없습니다.");
  return result;
}
export async function deleteSavings(item: Savings): Promise<void> {
  await request(`/${item.id}?version=${item.version}`, { method: "DELETE" });
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}
