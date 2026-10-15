import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { FIXED_COST_FIXTURE } from "../test/fixedCostFixture";
import Home from "./page";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
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
test("홈 요약에서 실제 지출·남은 예정액·결제 완료 건수를 확인한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue(FIXED_COST_FIXTURE);
  render(<Home />);
  const summary = await screen.findByRole("region", {
    name: "선택 월 지출 요약",
  });
  expect(within(summary).getByText("155,000원")).toBeTruthy();
  expect(within(summary).getByText("45,000원")).toBeTruthy();
  expect(within(summary).getByRole("progressbar").getAttribute("value")).toBe(
    "2",
  );
  expect(within(summary).getByRole("progressbar").getAttribute("max")).toBe(
    "4",
  );
});
test("DB 변경 후 새로고침하면 선택 월의 통계를 다시 조회한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue(FIXED_COST_FIXTURE);
  render(<Home />);
  await screen.findByRole("region", { name: "선택 월 지출 요약" });
  fireEvent.click(screen.getByRole("button", { name: "이전 달" }));
  await screen.findByRole("region", { name: "선택 월 지출 요약" });
  vi.mocked(getFixedCostDashboard).mockResolvedValue({
    ...FIXED_COST_FIXTURE,
    charges: [],
  });
  fireEvent.click(screen.getByRole("button", { name: "통계 새로고침" }));
  expect(await screen.findByText("이 달에 예정된 지출이 없어요.")).toBeTruthy();
  expect(getFixedCostDashboard).toHaveBeenLastCalledWith("2026-09");
});
test("새로고침 실패를 알리고 재시도하면 통계를 다시 표시한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue(FIXED_COST_FIXTURE);
  render(<Home />);
  await screen.findByRole("region", { name: "선택 월 지출 요약" });
  vi.mocked(getFixedCostDashboard).mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "통계 새로고침" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
  expect(
    await screen.findByRole("region", { name: "선택 월 지출 요약" }),
  ).toBeTruthy();
});
