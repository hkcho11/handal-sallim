// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { proxyBackend } from "./backendProxy";
import { SERVICE_UNAVAILABLE_MESSAGE } from "./serviceAvailability";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("forwards the query, auth and idempotency key without hop headers", async () => {
  vi.stubEnv("API_ORIGIN", "http://127.0.0.1:8081");
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ month: "2026-10" }));
  vi.stubGlobal("fetch", fetcher);
  const response = await proxyBackend(
    new Request("http://localhost/backend/incomes?month=2026-10", {
      headers: {
        cookie: "session=test",
        "idempotency-key": "test-key",
        connection: "x-internal",
        "x-internal": "remove",
      },
    }),
    ["incomes"],
  );
  const [target, init] = fetcher.mock.calls[0];
  expect(target.toString()).toBe(
    "http://127.0.0.1:8081/api/incomes?month=2026-10",
  );
  expect(init.headers.get("cookie")).toBe("session=test");
  expect(init.headers.get("idempotency-key")).toBe("test-key");
  expect(init.headers.has("x-internal")).toBe(false);
  expect(init.cache).toBe("no-store");
  expect(await response.json()).toEqual({ month: "2026-10" });
});

test.each([
  new TypeError("connect ECONNREFUSED 127.0.0.1:8081"),
  new DOMException("timed out", "TimeoutError"),
])(
  "returns a safe retryable 503 for an unavailable or timed-out backend (%s)",
  async (error) => {
    const fetcher = vi.fn().mockRejectedValue(error);
    vi.stubGlobal("fetch", fetcher);
    const response = await proxyBackend(
      new Request("http://localhost/backend/incomes", {
        method: "POST",
        body: "{}",
      }),
      ["incomes"],
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("3");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      message: SERVICE_UNAVAILABLE_MESSAGE,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

test("preserves JSON write bodies and upstream validation/conflict responses", async () => {
  const body = JSON.stringify({ name: "급여", amount: 3200000 });
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ message: "충돌" }, { status: 409 }));
  vi.stubGlobal("fetch", fetcher);
  const response = await proxyBackend(
    new Request("http://localhost/backend/incomes", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    }),
    ["incomes"],
  );
  expect(new TextDecoder().decode(fetcher.mock.calls[0][1].body)).toBe(body);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ message: "충돌" });
});

test("preserves empty delete responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
  );
  const response = await proxyBackend(
    new Request("http://localhost/backend/incomes/entry", { method: "DELETE" }),
    ["incomes", "entry"],
  );
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
});

test("does not allow paths to escape the API prefix", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const response = await proxyBackend(
    new Request("http://localhost/backend/incomes"),
    ["..", "private"],
  );
  expect(response.status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

test("preserves separate session and CSRF cookies", async () => {
  const upstream = new Response(null, { status: 204 });
  upstream.headers.append(
    "set-cookie",
    "HS_SESSION=fixture; Path=/; HttpOnly; SameSite=Lax",
  );
  upstream.headers.append(
    "set-cookie",
    "XSRF-TOKEN=fixture; Path=/; SameSite=Lax",
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream));
  const response = await proxyBackend(
    new Request("http://localhost/backend/auth/login", {
      method: "POST",
      body: "{}",
    }),
    ["auth", "login"],
  );
  expect(response.headers.getSetCookie()).toHaveLength(2);
  expect(response.headers.getSetCookie()[0]).toContain("HttpOnly");
});
