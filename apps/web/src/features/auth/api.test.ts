import { afterEach, expect, test, vi } from "vitest";
import { currentSession, parseSession, safeReturn, authAction } from "./api";
afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "XSRF-TOKEN=; Max-Age=0; path=/";
});
test("rejects malformed sessions and unsafe login destinations", () => {
  expect(() => parseSession({ userId: "test" })).toThrow();
  expect(safeReturn("//evil.test")).toBe("/");
  expect(safeReturn("/\\evil.test")).toBe("/");
  expect(safeReturn("/auth/login")).toBe("/");
  expect(safeReturn("/fixed-costs?category=test")).toBe(
    "/fixed-costs?category=test",
  );
});
test("unauthenticated session is distinguished from unavailable server", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 })),
  );
  expect(await currentSession()).toBeNull();
  await expect(currentSession()).rejects.toThrow(
    "계정 정보를 불러오지 못했습니다",
  );
});
test("auth writes attach the CSRF cookie and preserve safe error messages", async () => {
  document.cookie = "XSRF-TOKEN=csrf-fixture; path=/";
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ token: "csrf-fixture" }))
    .mockResolvedValueOnce(
      Response.json({ message: "이메일을 확인해 주세요." }, { status: 401 }),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    authAction("login", {
      email: "test@example.test",
      password: "TestFixture82",
    }),
  ).rejects.toThrow("이메일을 확인해 주세요.");
  const options = fetcher.mock.calls[1][1];
  expect(options.headers.get("X-XSRF-TOKEN")).toBe("csrf-fixture");
  expect(options.method).toBe("POST");
});

test("network and malformed gateway failures show a safe retry message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("private-network-detail")),
  );
  await expect(currentSession()).rejects.toThrow("서버에 연결하지 못했습니다");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ token: "fixture" }))
      .mockResolvedValueOnce(
        new Response("private-gateway-detail", { status: 502 }),
      ),
  );
  await expect(authAction("register", {})).rejects.toThrow(
    "서버 응답을 확인하지 못했습니다",
  );
});
