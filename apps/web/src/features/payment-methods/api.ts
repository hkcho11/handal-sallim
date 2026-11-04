import { apiFetch } from "../../shared/api/apiFetch";
import { SERVICE_UNAVAILABLE_MESSAGE } from "../../shared/api/serviceAvailability";
import {
  comparePaymentMethodNames,
  isPaymentMethodType,
  type PaymentMethodType,
} from "./types";
export { typeLabels } from "./types";

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  holderUserId: string | null;
  color: string | null;
  status: "ACTIVE" | "ARCHIVED";
  version: number;
}
export interface Member {
  id: string;
  name: string;
}
export type PaymentMethodInput = Pick<
  PaymentMethod,
  "name" | "type" | "holderUserId" | "color"
>;
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function uuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
function method(value: unknown): value is PaymentMethod {
  return (
    object(value) &&
    uuid(value.id) &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    isPaymentMethodType(value.type) &&
    (value.holderUserId === null || uuid(value.holderUserId)) &&
    (value.color === null ||
      (typeof value.color === "string" &&
        /^#[0-9a-f]{6}$/i.test(value.color))) &&
    (value.status === "ACTIVE" || value.status === "ARCHIVED") &&
    typeof value.version === "number" &&
    Number.isSafeInteger(value.version) &&
    value.version >= 0
  );
}
async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await apiFetch(`/backend/payment-methods${path}`, {
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
      400: "입력값을 확인해 주세요.",
      401: "로그인이 필요합니다.",
      403: "사용할 수 있는 공간이 없습니다.",
      404: "결제수단을 찾을 수 없습니다.",
      409: "결제수단이 변경되었습니다. 목록에서 최신 정보를 확인해 주세요.",
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
    throw new Error("응답을 확인할 수 없습니다.");
  }
}
export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const result = await request("");
  if (
    !Array.isArray(result) ||
    !result.every(method) ||
    new Set(result.map((item) => item.id)).size !== result.length
  )
    throw new Error("결제수단 응답을 확인할 수 없습니다.");
  return result.sort(comparePaymentMethodNames);
}
export async function listMembers(): Promise<Member[]> {
  const result = await request("/members");
  if (
    !Array.isArray(result) ||
    !result.every(
      (item): item is Member =>
        object(item) && uuid(item.id) && typeof item.name === "string",
    )
  )
    throw new Error("담당자 응답을 확인할 수 없습니다.");
  return result;
}
export async function savePaymentMethod(
  input: PaymentMethodInput,
  key: string,
  current?: PaymentMethod,
): Promise<PaymentMethod> {
  const result = await request(
    current ? `/${encodeURIComponent(current.id)}` : "",
    {
      method: current ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(current ? {} : { "Idempotency-Key": key }),
      },
      body: JSON.stringify({
        ...input,
        ...(current ? { version: current.version } : {}),
      }),
    },
  );
  if (!method(result) || result.id !== (current?.id ?? key))
    throw new Error("저장 응답을 확인할 수 없습니다.");
  return result;
}
export async function archivePaymentMethod(
  current: PaymentMethod,
): Promise<void> {
  await request(
    `/${encodeURIComponent(current.id)}/archive?version=${current.version}`,
    { method: "POST" },
  );
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}
