import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import Home from "./page";

vi.mock("../features/fixed-expenses/api", () => ({
  listFixedExpenses: vi.fn().mockResolvedValue([]),
}));

test("홈은 핵심 요약을 표시하고 중복 일정과 설명을 표시하지 않는다", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { name: "한달살림" })).toBeTruthy();
  expect(
    screen.queryByRole("region", { name: "다가오는 결제·지연 항목" }),
  ).toBeNull();
  expect(
    screen.queryByRole("region", { name: "이번 달 결제 현황" }),
  ).toBeNull();
  expect(
    screen.queryByText(/예시 합계에 실제 등록 금액은 포함되지 않습니다/),
  ).toBeNull();
  expect(screen.getByRole("region", { name: "등록한 고정비" })).toBeTruthy();
  const spending = within(
    screen.getByRole("region", { name: "이번 달 지출 요약" }),
  );
  expect(spending.getByText("419,000원")).toBeTruthy();
  expect(spending.getByText("818,000원")).toBeTruthy();
  expect(spending.getByText("예시 데이터")).toBeTruthy();
  expect(spending.getByText("1,237,000원")).toBeTruthy();
  expect(screen.getByRole("region", { name: "카테고리별 지출" })).toBeTruthy();
});
