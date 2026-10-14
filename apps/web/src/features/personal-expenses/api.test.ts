import { afterEach, expect, test, vi } from "vitest";
import {
  listPersonalExpenses,
  getPersonalExpense,
  savePersonalExpense,
  type PersonalExpense,
} from "./api";

afterEach(() => vi.unstubAllGlobals());
const item: PersonalExpense = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "테스트 지출",
  amount: 12300,
  occurredOn: "2026-10-14",
  categoryId: "22222222-2222-4222-8222-222222222222",
  categoryName: "식비",
  paymentMethodId: "33333333-3333-4333-8333-333333333333",
  paymentMethodName: "현금",
  memo: null,
  version: 0,
};
function respond(data: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status })),
  );
}
test("월이 다른 내역과 합계 불일치, 잘못된 날짜를 거부한다", async () => {
  for (const data of [
    {
      month: "2026-10",
      totalAmount: "12300",
      items: [{ ...item, occurredOn: "2026-11-01" }],
    },
    { month: "2026-10", totalAmount: "0", items: [item] },
    {
      month: "2026-10",
      totalAmount: "12300",
      items: [{ ...item, occurredOn: "2026-02-30" }],
    },
    { month: "2026-10", totalAmount: "24600", items: [item, item] },
  ]) {
    respond(data);
    await expect(listPersonalExpenses("2026-10")).rejects.toThrow(
      "응답을 확인할 수 없습니다",
    );
  }
});
test("서버 합계가 안전 정수 범위를 넘어도 정확하게 검증한다", async () => {
  respond({
    month: "2026-10",
    totalAmount: "18014398509481982",
    items: [
      { ...item, amount: Number.MAX_SAFE_INTEGER },
      {
        ...item,
        id: "44444444-4444-4444-8444-444444444444",
        amount: Number.MAX_SAFE_INTEGER,
      },
    ],
  });
  expect((await listPersonalExpenses("2026-10")).totalAmount).toBe(
    "18014398509481982",
  );
});
test("상세 id 불일치와 서버 내부 오류 내용을 노출하지 않는다", async () => {
  respond(item);
  await expect(
    getPersonalExpense("55555555-5555-4555-8555-555555555555"),
  ).rejects.toThrow("응답을 확인할 수 없습니다");
  respond({ message: "internal database details" }, 500);
  await expect(getPersonalExpense(item.id)).rejects.toThrow(
    "요청을 처리하지 못했습니다",
  );
});
test("저장 응답의 금액 타입과 안전 정수 범위를 검증한다", async () => {
  for (const amount of ["12300", 1.5, 0, Number.MAX_SAFE_INTEGER + 1]) {
    respond({ ...item, amount });
    await expect(
      savePersonalExpense({ ...item, privateConfirmed: false }, "key"),
    ).rejects.toThrow("응답을 확인할 수 없습니다");
  }
});
