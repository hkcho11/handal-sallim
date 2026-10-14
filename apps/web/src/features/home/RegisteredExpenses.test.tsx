import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { listFixedExpenses, type FixedExpense } from "../fixed-expenses/api";
import RegisteredExpenses from "./RegisteredExpenses";

vi.mock("../fixed-expenses/api", () => ({ listFixedExpenses: vi.fn() }));
beforeEach(() => vi.mocked(listFixedExpenses).mockReset());
afterEach(cleanup);

const expense: FixedExpense = {
  id: "test-expense",
  name: "테스트 등록 항목",
  expectedAmount: 42000,
  intervalMonths: null,
  recurringDayOfMonth: null,
  firstDueDate: null,
  firstChargeId: null,
  firstChargeStatus: null,
  payer: null,
  paymentMethodId: null,
  paymentMethodName: null,
};

test("일정 미정인 실제 등록 항목과 등록 금액 합계를 표시한다", async () => {
  vi.mocked(listFixedExpenses).mockResolvedValue([expense]);
  render(<RegisteredExpenses />);
  expect(
    await screen.findByRole("heading", { name: expense.name }),
  ).toBeTruthy();
  expect(screen.getByText("일정 미정")).toBeTruthy();
  expect(screen.getByText("첫 결제일 미정")).toBeTruthy();
  expect(
    screen.getByText(/실제 등록 내역 1건 · 등록 금액 합계 42,000원/),
  ).toBeTruthy();
});

test("첫 청구의 결제일, 지연 상태와 결제 정보를 표시한다", async () => {
  vi.mocked(listFixedExpenses).mockResolvedValue([
    {
      ...expense,
      firstDueDate: "2026-10-10",
      firstChargeStatus: "OVERDUE",
      payer: "ME",
      paymentMethodName: "테스트 계좌",
    },
  ]);
  render(<RegisteredExpenses />);
  expect(await screen.findByText("지연")).toBeTruthy();
  expect(screen.getByText("첫 결제일 2026-10-10")).toBeTruthy();
  expect(screen.getByText("담당자 나 · 테스트 계좌")).toBeTruthy();
});

test("조회 실패를 빈 목록으로 표시하지 않고 다시 불러올 수 있다", async () => {
  vi.mocked(listFixedExpenses)
    .mockRejectedValueOnce(new Error("unavailable"))
    .mockResolvedValueOnce([expense]);
  render(<RegisteredExpenses />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText(/등록한 고정비가 없습니다/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
  expect(
    await screen.findByRole("heading", { name: expense.name }),
  ).toBeTruthy();
});
