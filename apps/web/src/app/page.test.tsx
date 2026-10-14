import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { FIXED_COST_FIXTURE } from "../test/fixedCostFixture";
import Home from "./page";
vi.mock("../features/home/fixedCostApi", () => ({
  getFixedCostDashboard: vi.fn(),
}));
import { getFixedCostDashboard } from "../features/home/fixedCostApi";
test("홈은 고정비 대분류·중분류 변화·결제수단의 세 통계를 순서대로 표시한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue(FIXED_COST_FIXTURE);
  render(<Home />);
  const major = await screen.findByRole("region", {
    name: "대분류별 지출 통계",
  });
  expect(within(major).getAllByText("205,000원")).toHaveLength(1);
  expect(
    screen.getByRole("region", { name: "중분류별 월별 변화" }),
  ).toBeTruthy();
  expect(screen.getByRole("region", { name: "결제수단별 지출" })).toBeTruthy();
  expect(
    screen.queryByRole("region", { name: "이번 달 지출 요약" }),
  ).toBeNull();
  expect(screen.queryByRole("region", { name: "등록한 고정비" })).toBeNull();
  expect(screen.getByText("+10,000원 (+22.2%)")).toBeTruthy();
});
