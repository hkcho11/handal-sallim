import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import FixedExpensesScreen from "./FixedExpensesScreen";
import { createFixedExpense, listFixedExpenses } from "./api";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    listFixedExpenses: vi.fn(),
    createFixedExpense: vi.fn(),
  };
});

beforeEach(() => {
  vi.mocked(listFixedExpenses).mockReset();
  vi.mocked(createFixedExpense).mockReset();
});

afterEach(cleanup);

test("고정비를 등록하면 첫 예정 청구를 목록에서 확인한다", async () => {
  vi.mocked(listFixedExpenses).mockResolvedValue([]);
  vi.mocked(createFixedExpense).mockResolvedValue({
    id: "expense-1",
    name: "월세",
    expectedAmount: 650000,
    intervalMonths: 1,
    firstDueDate: "2026-10-15",
    firstChargeId: "charge-1",
    firstChargeStatus: "PENDING",
  });
  render(<FixedExpensesScreen />);
  await screen.findByText("등록한 고정비가 없습니다.");
  fireEvent.change(screen.getByLabelText("비용명"), {
    target: { value: "월세" },
  });
  fireEvent.change(screen.getByLabelText("최초 예상 금액 (원)"), {
    target: { value: "650000" },
  });
  fireEvent.change(screen.getByLabelText("반복 주기"), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText("첫 예정일"), {
    target: { value: "2026-10-15" },
  });
  fireEvent.click(screen.getByRole("button", { name: "고정비 저장" }));
  await waitFor(() => expect(createFixedExpense).toHaveBeenCalledOnce());
  expect(await screen.findByText("650,000원")).toBeTruthy();
  expect(screen.getByText("첫 예정 2026-10-15")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("등록했습니다");
});

test("로그인이 없으면 안전한 안내를 표시하고 저장을 막는다", async () => {
  vi.mocked(listFixedExpenses).mockRejectedValue(
    new Error("database failure detail"),
  );
  render(<FixedExpensesScreen />);
  expect(
    await screen.findByText("요청을 처리하지 못했습니다. 다시 시도해 주세요."),
  ).toBeTruthy();
  expect(screen.queryByText("database failure detail")).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "고정비 저장" })
      .hasAttribute("disabled"),
  ).toBe(true);
});
