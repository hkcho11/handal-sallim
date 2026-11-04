import { afterEach, expect, test, vi } from "vitest";
import {
  createFixedExpense,
  deleteFixedExpense,
  listFixedExpenses,
  getFixedExpenseFormOptions,
} from "./api";

afterEach(() => vi.unstubAllGlobals());

test("고정비 선택지가 신규 결제수단 종류를 수용하고 가나다순으로 표시된다", async () => {
  const paymentMethods = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "하나 신용",
      type: "CREDIT_CARD",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "국민 체크",
      type: "DEBIT_CARD",
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "간편 지갑",
      type: "SIMPLE_PAY",
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ payers: [], paymentMethods })),
      ),
  );
  const result = await getFixedExpenseFormOptions();
  expect(result.paymentMethods.map((item) => item.name)).toEqual([
    "간편 지갑",
    "국민 체크",
    "하나 신용",
  ]);
});

test("삭제의 빈 성공 응답을 처리하고 권한 오류 원문을 숨긴다", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response("internal details", { status: 403 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(deleteFixedExpense("expense-id")).resolves.toBeUndefined();
  expect(fetchMock).toHaveBeenCalledWith(
    "/backend/recurring-expenses/expense-id",
    expect.objectContaining({ method: "DELETE" }),
  );
  await expect(deleteFixedExpense("expense-id")).rejects.toThrow(
    "사용할 수 있는 공간이 없습니다.",
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
        memo: null,
        categoryId: "11111111-1111-4111-8111-111111111111",
        subcategoryId: "22222222-2222-4222-8222-222222222222",
        expectedAmount: 650000,
        intervalMonths: 1,
        recurringDayOfMonth: 15,
        firstDueDate: "2026-10-15",
        payer: null,
        paymentMethodId: null,
      },
      "request-key",
    ),
  ).rejects.toThrow("로그인이 필요합니다.");
});
