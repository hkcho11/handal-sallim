import { afterEach, expect, test, vi } from "vitest";
import { cachedRead, invalidateReads, setReadScope } from "./readCache";
import { apiFetch } from "./apiFetch";

afterEach(() => {
  setReadScope(null);
  invalidateReads();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("인증된 범위가 없으면 재사용하지 않는다", async () => {
  setReadScope(null);
  const load = vi.fn().mockResolvedValue({ amount: 1 });
  await cachedRead("list", load);
  await cachedRead("list", load);
  expect(load).toHaveBeenCalledTimes(2);
});

test("짧은 시간의 재방문을 재사용하고 반환 객체 수정은 원본을 바꾸지 않는다", async () => {
  setReadScope("first");
  const load = vi.fn().mockResolvedValue({ amount: 1 });
  const result = await cachedRead<{ amount: number }>("list", load);
  result.amount = 9;
  expect(await cachedRead("list", load)).toEqual({ amount: 1 });
  expect(load).toHaveBeenCalledTimes(1);
});

test("만료와 명시적 새로고침은 다시 조회한다", async () => {
  vi.useFakeTimers();
  setReadScope("first");
  const load = vi.fn().mockResolvedValue({ amount: 1 });
  await cachedRead("list", load);
  await cachedRead("list", load, true);
  expect(load).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(10_001);
  await cachedRead("list", load);
  expect(load).toHaveBeenCalledTimes(3);
});

test("같은 조회의 동시 요청을 합친다", async () => {
  setReadScope("first");
  let release!: (value: { amount: number }) => void;
  const load = vi.fn(
    () =>
      new Promise<{ amount: number }>((resolve) => {
        release = resolve;
      }),
  );
  const first = cachedRead("list", load),
    second = cachedRead("list", load);
  release({ amount: 1 });
  expect(await first).toEqual(await second);
  expect(load).toHaveBeenCalledTimes(1);
});

test("계정 변경 뒤 늦게 온 이전 응답을 새 계정 캐시에 넣지 않는다", async () => {
  setReadScope("first");
  let release!: (value: string) => void;
  const previous = cachedRead(
    "list",
    () =>
      new Promise<string>((resolve) => {
        release = resolve;
      }),
  );
  setReadScope("second");
  const next = vi.fn().mockResolvedValue("second-account");
  expect(await cachedRead("list", next)).toBe("second-account");
  release("first-account");
  await previous;
  expect(await cachedRead("list", next)).toBe("second-account");
  expect(next).toHaveBeenCalledTimes(1);
});

test("공유 변경을 포함한 쓰기 요청이 시작되면 즉시 무효화한다", async () => {
  setReadScope("first");
  const load = vi.fn().mockResolvedValue(1);
  await cachedRead("list", load);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
  );
  await apiFetch("/backend/sharing/requests/fixture", { method: "POST" });
  await cachedRead("list", load);
  expect(load).toHaveBeenCalledTimes(2);
});

test("권한 거절이면 보관 데이터를 지우고 재사용을 중단한다", async () => {
  setReadScope("first");
  const load = vi.fn().mockResolvedValue(1);
  await cachedRead("list", load);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
  );
  await apiFetch("/backend/incomes");
  await cachedRead("list", load);
  await cachedRead("list", load);
  expect(load).toHaveBeenCalledTimes(3);
});

test("저장 도중 시작한 조회도 저장 완료 뒤에는 다시 조회한다", async () => {
  setReadScope("first");
  let release!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    ),
  );
  const write = apiFetch("/backend/incomes", { method: "POST" });
  const load = vi.fn().mockResolvedValue(1);
  await cachedRead("list", load);
  release(new Response(null, { status: 204 }));
  await write;
  await cachedRead("list", load);
  expect(load).toHaveBeenCalledTimes(2);
});

test("실패 응답은 저장하지 않고 재시도한다", async () => {
  setReadScope("first");
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(1);
  await expect(cachedRead("list", load)).rejects.toThrow("offline");
  expect(await cachedRead("list", load)).toBe(1);
});
