import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import Home from "./page";

vi.mock("../features/fixed-expenses/api", () => ({
  listFixedExpenses: vi.fn().mockResolvedValue([]),
}));

test("예시 대시보드에 미결제 일정과 금액 요약을 표시한다", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { name: "한달살림" })).toBeTruthy();
  expect(
    screen.getByText(/예시 합계에 실제 등록 금액은 포함되지 않습니다/),
  ).toBeTruthy();
  expect(screen.getByText("미결제 4건")).toBeTruthy();
  expect(screen.getByText("지연 1건 포함")).toBeTruthy();
  const summary = within(
    screen.getByRole("region", { name: "이번 달 결제 현황" }),
  );
  expect(summary.getByText("818,000원")).toBeTruthy();
  expect(summary.getByText("135,000원")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "결제수단 미지정" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "내 개인 내역" })).toBeTruthy();
});
