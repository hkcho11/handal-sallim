import { afterEach, expect, test, vi } from "vitest";
import { createFixedExpense, listFixedExpenses } from "./api";

afterEach(() => vi.unstubAllGlobals());

test("잘못된 서버 목록은 화면으로 전달하지 않는다", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify([{ name: "월세", expectedAmount: "650000" }]),
          { status: 200 },
        ),
      ),
  );
  await expect(listFixedExpenses()).rejects.toThrow(
    "목록 응답을 확인할 수 없습니다",
  );
});

test("인증 실패 응답에서 서버 원문을 노출하지 않는다", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "internal database detail" }), {
        status: 401,
      }),
    ),
  );
  await expect(
    createFixedExpense(
      {
        name: "월세",
        expectedAmount: 650000,
        intervalMonths: 1,
        firstDueDate: "2026-10-15",
      },
      "request-key",
    ),
  ).rejects.toThrow("로그인이 필요합니다.");
});
