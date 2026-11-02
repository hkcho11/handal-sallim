import { apiFetch } from "./apiFetch";
import { SERVICE_UNAVAILABLE_MESSAGE } from "./serviceAvailability";

export interface OwnerMember {
  id: string;
  name: string;
}
export interface OwnerOptions {
  currentUserId: string;
  members: OwnerMember[];
}
export function isOwnerId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function hasOwner(value: Record<string, unknown>) {
  return (
    isOwnerId(value.ownerUserId) &&
    typeof value.ownerName === "string" &&
    value.ownerName.trim().length > 0
  );
}
export async function listOwners(
  resource: "incomes" | "savings",
): Promise<OwnerOptions> {
  let response: Response;
  try {
    response = await apiFetch(`/backend/${resource}/members`, {
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new Error("소유자 목록에 연결할 수 없습니다. 다시 시도해 주세요.");
  }
  if (response.status === 503) throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "로그인이 필요합니다."
        : response.status === 403
          ? "사용할 수 있는 공간이 없습니다."
          : "소유자 목록을 불러오지 못했습니다. 다시 시도해 주세요.",
    );
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("소유자 응답을 확인할 수 없습니다.");
  }
  if (
    typeof result !== "object" ||
    result === null ||
    !("currentUserId" in result) ||
    !isOwnerId(result.currentUserId) ||
    !("members" in result) ||
    !Array.isArray(result.members) ||
    !result.members.every(
      (item): item is OwnerMember =>
        typeof item === "object" &&
        item !== null &&
        isOwnerId(item.id) &&
        typeof item.name === "string" &&
        item.name.trim().length > 0,
    ) ||
    !result.members.some((item) => item.id === result.currentUserId) ||
    new Set(result.members.map((item) => item.id)).size !==
      result.members.length
  )
    throw new Error("소유자 응답을 확인할 수 없습니다.");
  return { currentUserId: result.currentUserId, members: result.members };
}
