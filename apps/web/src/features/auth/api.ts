import { apiFetch } from "../../shared/api/apiFetch";

async function fetchAuth(path: string, init?: RequestInit) {
  try {
    return await apiFetch(`/backend/auth/${path}`, init);
  } catch {
    throw new Error(
      "서버에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
    );
  }
}

export interface AccountSession {
  userId: string;
  name: string;
  hasSpace: boolean;
}
export function parseSession(value: unknown): AccountSession {
  if (
    !value ||
    typeof value !== "object" ||
    !("userId" in value) ||
    typeof value.userId !== "string" ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !("hasSpace" in value) ||
    typeof value.hasSpace !== "boolean"
  )
    throw new Error("계정 정보를 확인하지 못했습니다.");
  return { userId: value.userId, name: value.name, hasSpace: value.hasSpace };
}
export async function currentSession(): Promise<AccountSession | null> {
  const response = await fetchAuth("session", {
    cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok)
    throw new Error(
      "계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  return parseSession(await response.json());
}
export async function authAction(
  action: string,
  body: Record<string, string | boolean> = {},
): Promise<unknown> {
  await initializeCsrf();
  const response = await fetchAuth(action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  if (!response.ok)
    throw new Error(
      data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string"
        ? data.message
        : "요청을 처리하지 못했습니다.",
    );
  return data;
}
export function safeReturn(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.startsWith("/auth") ||
    /[\u0000-\u001f]/.test(value)
  )
    return "/";
  return value;
}

export async function initializeCsrf() {
  const csrf = await fetchAuth("csrf", { cache: "no-store" });
  if (!csrf.ok)
    throw new Error("서버에 연결하지 못했습니다. 다시 시도해 주세요.");
}
