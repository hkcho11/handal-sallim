import { afterEach, expect, test, vi } from "vitest";
import { apiFetch } from "./apiFetch";
import { loadingState } from "../loadingState";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("응답 본문 수신까지 차단하고 호출자는 본문을 읽을 수 있다", async () => {
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      stream = controller;
    },
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
  const pending = apiFetch("/backend/test");
  expect(loadingState.snapshot()).toBe(true);
  stream.enqueue(new TextEncoder().encode('{"saved":true}'));
  stream.close();
  const response = await pending;
  expect(loadingState.snapshot()).toBe(false);
  expect(await response.json()).toEqual({ saved: true });
});

test("연결 실패 시 차단을 해제한다", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await expect(apiFetch("/backend/test")).rejects.toThrow("offline");
  expect(loadingState.snapshot()).toBe(false);
});

test("응답이 없는 요청을 중단하고 차단을 해제한다", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    ),
  );
  const pending = expect(apiFetch("/backend/test")).rejects.toThrow("aborted");
  expect(loadingState.snapshot()).toBe(true);
  await vi.advanceTimersByTimeAsync(15000);
  await pending;
  expect(loadingState.snapshot()).toBe(false);
});
