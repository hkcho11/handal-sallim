import { afterEach, expect, test, vi } from "vitest";
import { parseSharing, parseMember, loadSharing, sendRequest } from "./api";
afterEach(() => {
  vi.unstubAllGlobals();
});
const fixture = {
  memberCode: "7KMP-4XQ9",
  connection: null,
  received: [],
  sent: [],
};
test("validates sharing identity and request responses", () => {
  expect(parseSharing(fixture)).toEqual(fixture);
  expect(() =>
    parseSharing({ ...fixture, connection: { partnerName: "상대" } }),
  ).toThrow();
  expect(() =>
    parseSharing({
      ...fixture,
      received: [
        {
          name: "상대",
          memberCode: "2222-3333",
          id: "request",
          status: "INVALID",
        },
      ],
    }),
  ).toThrow();
  expect(() => parseMember({ name: "상대", email: "not-a-code" })).toThrow();
});
test("validates pending disconnection identity and which member must consent", () => {
  const connection = {
    spaceId: "space",
    partnerName: "상대",
    startedAt: "2026-10-27T00:00:00Z",
    disconnectRequest: {
      id: "request",
      requestedByMe: false,
      createdAt: "2026-10-27T00:00:00Z",
      expiresAt: "2026-10-28T00:00:00Z",
    },
  };
  expect(parseSharing({ ...fixture, connection }).connection).toEqual(
    connection,
  );
  expect(() =>
    parseSharing({
      ...fixture,
      connection: {
        ...connection,
        disconnectRequest: {
          ...connection.disconnectRequest,
          requestedByMe: "false",
        },
      },
    }),
  ).toThrow();
  expect(() =>
    parseSharing({
      ...fixture,
      connection: { ...connection, disconnectRequest: {} },
    }),
  ).toThrow();
});
test("unavailable service does not appear as an empty request inbox", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("private detail")),
  );
  await expect(loadSharing()).rejects.toThrow("서버에 연결하지 못했습니다");
});
test("sending a request preserves the server's refusal reason", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ token: "fixture" }))
      .mockResolvedValueOnce(
        Response.json(
          { message: "이미 함께 쓰는 상대가 있습니다." },
          { status: 409 },
        ),
      ),
  );
  await expect(sendRequest("7KMP-4XQ9")).rejects.toThrow(
    "이미 함께 쓰는 상대가 있습니다",
  );
});
