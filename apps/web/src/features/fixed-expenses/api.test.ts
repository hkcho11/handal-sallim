import { afterEach, expect, test, vi } from "vitest";
import { createFixedExpense, listFixedExpenses } from "./api";

afterEach(() => vi.unstubAllGlobals());

const unscheduled = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "일정 미정 고정비",
  expectedAmount: 42000,
  intervalMonths: null,
  recurringDayOfMonth: null,
  firstDueDate: null,
  firstChargeId: null,
  firstChargeStatus: null,
  payer: "ME",
  paymentMethodId: "22222222-2222-4222-8222-222222222222",
  paymentMethodName: "테스트 계좌",
};

test("일정 미정과 선택 결제 정보가 포함된 목록 응답을 검증한다", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([unscheduled]), { status: 200 }),
      ),
  );
  await expect(listFixedExpenses()).resolves.toEqual([unscheduled]);
});

test.each([
  { payer: "INVALID" },
  { paymentMethodId: "invalid" },
  { recurringDayOfMonth: 32 },
  { recurringDayOfMonth: 1.5 },
  { paymentMethodName: 123 },
])("잘못된 선택 결제 정보도 화면에 전달하지 않는다: %j", async (invalid) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ ...unscheduled, ...invalid }]), {
        status: 200,
      }),
    ),
  );
  await expect(listFixedExpenses()).rejects.toThrow(
    "목록 응답을 확인할 수 없습니다",
  );
});

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
