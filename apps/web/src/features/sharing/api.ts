import { apiFetch } from "../../shared/api/apiFetch";
import { initializeCsrf } from "../auth/api";
export interface Member {
  name: string;
  memberCode: string;
}
export interface SharingRequest extends Member {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "EXPIRED";
  createdAt: string;
  expiresAt: string;
}
export interface SharingState {
  memberCode: string;
  connection: {
    spaceId: string;
    partnerName: string;
    startedAt: string;
    disconnectRequest: DisconnectRequest | null;
  } | null;
  received: SharingRequest[];
  sent: SharingRequest[];
}
export interface DisconnectRequest {
  id: string;
  requestedByMe: boolean;
  createdAt: string;
  expiresAt: string;
}
export interface ArchiveEntry {
  kind: string;
  name: string;
  amount: number | null;
  date: string | null;
  status: string;
}
export interface Archive {
  spaceId: string;
  spaceName: string;
  archivedAt: string;
  scope: "PRIVATE" | "SHARED";
  entries: ArchiveEntry[];
}
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function string(value: unknown): value is string {
  return typeof value === "string";
}
function invalid(): never {
  throw new Error("연결 정보를 확인하지 못했습니다. 다시 불러와 주세요.");
}
export function parseMember(value: unknown): Member {
  if (!object(value) || !string(value.name) || !string(value.memberCode))
    return invalid();
  return { name: value.name, memberCode: value.memberCode };
}
function parseRequests(value: unknown): SharingRequest[] {
  if (!Array.isArray(value)) return invalid();
  return value.map((item: unknown) => {
    const member = parseMember(item);
    if (
      !object(item) ||
      !string(item.id) ||
      !string(item.createdAt) ||
      !string(item.expiresAt) ||
      !string(item.status) ||
      !["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"].includes(
        item.status,
      )
    )
      return invalid();
    return {
      ...member,
      id: item.id,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
      status: item.status as SharingRequest["status"],
    };
  });
}
export function parseSharing(value: unknown): SharingState {
  if (!object(value) || !string(value.memberCode)) return invalid();
  let connection: SharingState["connection"] = null;
  if (value.connection !== null) {
    const c = value.connection;
    if (
      !object(c) ||
      !string(c.spaceId) ||
      !string(c.partnerName) ||
      !string(c.startedAt)
    )
      return invalid();
    connection = {
      spaceId: c.spaceId,
      partnerName: c.partnerName,
      startedAt: c.startedAt,
      disconnectRequest: parseDisconnect(c.disconnectRequest),
    };
  }
  return {
    memberCode: value.memberCode,
    connection,
    received: parseRequests(value.received),
    sent: parseRequests(value.sent),
  };
}
function parseDisconnect(value: unknown): DisconnectRequest | null {
  // During a rolling API update, the previous response has no disconnection field.
  if (value === null || value === undefined) return null;
  if (
    !object(value) ||
    !string(value.id) ||
    typeof value.requestedByMe !== "boolean" ||
    !string(value.createdAt) ||
    !string(value.expiresAt)
  )
    return invalid();
  return {
    id: value.id,
    requestedByMe: value.requestedByMe,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  };
}
async function request(
  path: string,
  body?: Record<string, string>,
): Promise<unknown> {
  if (body) await initializeCsrf();
  let response: Response;
  try {
    response = await apiFetch(`/backend/sharing${path}`, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("서버에 연결하지 못했습니다. 다시 시도해 주세요.");
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return invalid();
  }
  if (!response.ok)
    throw new Error(
      object(data) && string(data.message)
        ? data.message
        : "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
    );
  return data;
}
export async function loadSharing() {
  return parseSharing(await request(""));
}
export async function lookupMember(memberCode: string) {
  return parseMember(await request("/lookup", { memberCode }));
}
export async function sendRequest(memberCode: string) {
  return parseSharing(await request("/requests", { memberCode }));
}
export async function decideRequest(
  id: string,
  action: "ACCEPT" | "REJECT" | "CANCEL",
) {
  return parseSharing(
    await request(`/requests/${encodeURIComponent(id)}`, { action }),
  );
}
export async function rotateCode() {
  return parseSharing(await request("/member-code", {}));
}
export async function requestDisconnect(spaceId: string) {
  return parseSharing(
    await request(
      `/connections/${encodeURIComponent(spaceId)}/disconnect-requests`,
      {},
    ),
  );
}
export async function decideDisconnect(
  id: string,
  action: "ACCEPT" | "REJECT" | "CANCEL",
) {
  return parseSharing(
    await request(`/disconnect-requests/${encodeURIComponent(id)}`, { action }),
  );
}
export async function loadArchives(): Promise<Archive[]> {
  const data = await request("/archives");
  if (!Array.isArray(data)) return invalid();
  return data.map((item: unknown) => {
    if (
      !object(item) ||
      !string(item.spaceId) ||
      !string(item.spaceName) ||
      !string(item.archivedAt) ||
      (item.scope !== undefined &&
        item.scope !== "PRIVATE" &&
        item.scope !== "SHARED") ||
      !Array.isArray(item.entries)
    )
      return invalid();
    const entries: ArchiveEntry[] = item.entries.map((entry: unknown) => {
      if (
        !object(entry) ||
        !string(entry.kind) ||
        !string(entry.name) ||
        (entry.amount !== null &&
          (typeof entry.amount !== "number" ||
            !Number.isSafeInteger(entry.amount))) ||
        (entry.date !== null && !string(entry.date)) ||
        !string(entry.status)
      )
        return invalid();
      return {
        kind: entry.kind,
        name: entry.name,
        amount: entry.amount,
        date: entry.date,
        status: entry.status,
      };
    });
    return {
      spaceId: item.spaceId,
      spaceName: item.spaceName,
      archivedAt: item.archivedAt,
      scope: item.scope === "SHARED" ? "SHARED" : "PRIVATE",
      entries,
    };
  });
}
