import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { FIXED_COST_FIXTURE, charge } from "../test/fixedCostFixture";
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
  expect(within(major).getAllByText("155,000원")).toHaveLength(1);
  expect(
    screen.getByRole("region", { name: "중분류별 월별 변화" }),
  ).toBeTruthy();
  expect(screen.getByRole("region", { name: "결제수단별 지출" })).toBeTruthy();
  expect(
    screen.queryByRole("region", { name: "이번 달 지출 요약" }),
  ).toBeNull();
  expect(screen.queryByRole("region", { name: "등록한 고정비" })).toBeNull();
  expect(
    screen.queryByRole("region", { name: "선택 월 지출 요약" }),
  ).toBeNull();
  expect(screen.getByText("+10,000원 (+22.2%)")).toBeTruthy();
});
test("DB 변경 후 새로고침하면 선택 월의 통계를 다시 조회한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue(FIXED_COST_FIXTURE);
  render(<Home />);
  await screen.findByRole("region", { name: "대분류별 지출 통계" });
  fireEvent.click(screen.getByRole("button", { name: "이전 달" }));
  await screen.findByRole("region", { name: "대분류별 지출 통계" });
  vi.mocked(getFixedCostDashboard).mockResolvedValue({
    ...FIXED_COST_FIXTURE,
    charges: [],
  });
  fireEvent.click(screen.getByRole("button", { name: "통계 새로고침" }));
  expect(
    await screen.findByText("이 달에 등록된 고정비 청구가 없어요."),
  ).toBeTruthy();
  expect(getFixedCostDashboard).toHaveBeenLastCalledWith("2026-09");
});
test("새로고침 실패를 알리고 재시도하면 통계를 다시 표시한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue(FIXED_COST_FIXTURE);
  render(<Home />);
  await screen.findByRole("region", { name: "대분류별 지출 통계" });
  vi.mocked(getFixedCostDashboard).mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "통계 새로고침" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
  expect(
    await screen.findByRole("region", { name: "대분류별 지출 통계" }),
  ).toBeTruthy();
});
test("월별 막대를 선택하면 정확한 금액과 증감이 바뀌고 기록 없는 달도 확인한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue(FIXED_COST_FIXTURE);
  render(<Home />);
  const trend = within(
    await screen.findByRole("region", { name: "중분류별 월별 변화" }),
  );
  const october = trend.getByRole("button", { name: /2026년 10월, 55,000원/ });
  expect(october.getAttribute("aria-pressed")).toBe("true");
  expect(trend.getByText("5.5만")).toBeTruthy();
  expect(trend.queryByText("월별 금액·증감 보기")).toBeNull();
  fireEvent.click(trend.getByRole("button", { name: /2026년 9월, 45,000원/ }));
  expect(trend.getByText("전기 · 2026년 9월")).toBeTruthy();
  expect(trend.getByText("45,000원")).toBeTruthy();
  expect(october.getAttribute("aria-pressed")).toBe("false");
  expect(trend.getByText("비교 기록 없음")).toBeTruthy();
  fireEvent.click(trend.getByRole("button", { name: /2026년 8월, 기록 없음/ }));
  expect(trend.getByText("기록 없음")).toBeTruthy();
  fireEvent.click(october);
  expect(trend.getByText("+10,000원 (+22.2%)")).toBeTruthy();
});
test("미결제 0원과 전월 0원의 증감률을 선택한 달 기준으로 표시한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue({
    ...FIXED_COST_FIXTURE,
    charges: [
      charge("pending", "2026-09", null),
      charge("paid", "2026-10", 10000),
    ],
  });
  render(<Home />);
  const trend = within(
    await screen.findByRole("region", { name: "중분류별 월별 변화" }),
  );
  expect(trend.getByText("+10,000원 (—)")).toBeTruthy();
  fireEvent.click(trend.getByRole("button", { name: /2026년 9월, 0원/ }));
  expect(trend.getByText("0원")).toBeTruthy();
  expect(trend.getByText("미결제 1건 · 예정 30,000원")).toBeTruthy();
});
