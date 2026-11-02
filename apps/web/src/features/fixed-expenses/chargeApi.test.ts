import { afterEach, expect, test, vi } from "vitest";
import { loadCharges, parseCharge } from "./chargeApi";
afterEach(() => vi.unstubAllGlobals());
const pending = {
  id: "11111111-1111-4111-8111-111111111111",
  recurringExpenseId: "22222222-2222-4222-8222-222222222222",
  name: "통신비",
  dueDate: "2026-10-10",
  expectedAmount: null,
  status: "PENDING",
  actualAmount: null,
  actualPaidOn: null,
  plannedPaymentMethodId: null,
  actualPaymentMethodId: null,
  paymentMethodName: null,
  version: 0,
};
test("미결제 회차의 금액 미정은 0원으로 바꾸지 않고 보존한다", () => {
  expect(parseCharge(pending).expectedAmount).toBeNull();
  expect(() => parseCharge({ ...pending, expectedAmount: 0 })).toThrow();
  expect(() => parseCharge({ ...pending, status: "COMPLETED" })).toThrow();
  expect(() => parseCharge({ ...pending, dueDate: "2026-02-30" })).toThrow();
});
test("완료 응답에는 실제 금액·결제일·결제수단이 있어야 한다", () => {
  const completed = {
    ...pending,
    status: "COMPLETED",
    actualAmount: 35000,
    actualPaidOn: "2026-10-10",
    actualPaymentMethodId: "33333333-3333-4333-8333-333333333333",
  };
  expect(parseCharge(completed).actualAmount).toBe(35000);
  expect(() => parseCharge({ ...completed, actualAmount: null })).toThrow();
});
test("연결 실패를 결제 내역이 없는 상태로 바꾸지 않는다", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fixture")));
  await expect(loadCharges(pending.recurringExpenseId)).rejects.toThrow(
    "서버에 연결하지 못했습니다",
  );
});
