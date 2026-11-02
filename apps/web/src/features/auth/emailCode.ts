const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface PendingEmailCode {
  requestId: string;
  email: string;
  phase: "code" | "password";
}
export function parseCodeRequest(value: unknown): string {
  if (
    !value ||
    typeof value !== "object" ||
    !("requestId" in value) ||
    typeof value.requestId !== "string" ||
    !uuid.test(value.requestId)
  )
    throw new Error("인증 요청을 확인하지 못했습니다. 다시 요청해 주세요.");
  return value.requestId;
}
export function parseCodeGrant(value: unknown): string {
  if (
    !value ||
    typeof value !== "object" ||
    !("token" in value) ||
    typeof value.token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(value.token)
  )
    throw new Error(
      "인증 결과를 확인하지 못했습니다. 새 번호를 요청해 주세요.",
    );
  return value.token;
}
function key(reset: boolean) {
  return `handal.auth.pending.${reset ? "reset" : "signup"}`;
}
export function pendingEmailCode(reset: boolean): PendingEmailCode | null {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(key(reset)) ?? "null",
    );
    if (
      !value ||
      typeof value !== "object" ||
      !("email" in value) ||
      typeof value.email !== "string" ||
      value.email.length > 254 ||
      !("phase" in value) ||
      !["code", "password"].includes(String(value.phase))
    )
      return null;
    return {
      requestId: parseCodeRequest(value),
      email: value.email,
      phase: value.phase as "code" | "password",
    };
  } catch {
    return null;
  }
}
export function saveEmailCode(reset: boolean, value: PendingEmailCode | null) {
  // Never persist the code, password, completion grant, or login session identifier.
  try {
    if (value) sessionStorage.setItem(key(reset), JSON.stringify(value));
    else sessionStorage.removeItem(key(reset));
  } catch {
    /* Storage may be disabled; the current page can still complete. */
  }
}
