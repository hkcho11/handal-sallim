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
test("홈은 고정비 상위 분류·세부 분류 변화·결제수단 통계를 순서대로 표시한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue(FIXED_COST_FIXTURE);
  render(<Home />);
  const major = await screen.findByRole("region", {
    name: "상위 분류별 지출 통계",
  });
  expect(within(major).getAllByText("155,000원")).toHaveLength(1);
  expect(within(major).getByText("총 결제액")).toBeTruthy();
  expect(within(major).queryByRole("heading")).toBeNull();
  expect(within(major).queryByRole("list", { name: "미결제 회차" })).toBeNull();
  expect(within(major).queryByText("실제 결제액")).toBeNull();
  expect(within(major).queryByText(/^(완료|미결제) \d+건/)).toBeNull();
  const legend = within(major).getByRole("list", { name: "분류별 지출 비중" });
  expect(
    within(legend)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["주거 64.5%", "공과금 35.5%"]);
  const utilities = within(major).getByRole("button", { name: /공과금/ });
  expect(utilities.textContent).toContain("전월 대비");
  expect(utilities.textContent).not.toContain("35.5%");
  expect(utilities.querySelector('[data-direction="increase"]')).toBeTruthy();
  expect(
    screen.getByRole("region", { name: "세부 분류별 월별 변화" }),
  ).toBeTruthy();
  expect(screen.getByRole("region", { name: "결제수단별 지출" })).toBeTruthy();
  expect(
    screen.queryByRole("region", { name: "이번 달 지출 요약" }),
  ).toBeNull();
  expect(screen.queryByRole("region", { name: "등록한 고정비" })).toBeNull();
  expect(
    screen.queryByRole("region", { name: "선택 월 지출 요약" }),
  ).toBeNull();
  expect(within(major).getByText("10,000원 (22.2%)")).toBeTruthy();
});
test("DB 변경 후 새로고침하면 선택 월의 통계를 다시 조회한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue(FIXED_COST_FIXTURE);
  render(<Home />);
  await screen.findByRole("region", { name: "상위 분류별 지출 통계" });
  fireEvent.click(screen.getByRole("button", { name: "이전 달" }));
  await screen.findByRole("region", { name: "상위 분류별 지출 통계" });
  vi.mocked(getFixedCostDashboard).mockResolvedValue({
    ...FIXED_COST_FIXTURE,
    charges: [],
  });
  fireEvent.click(screen.getByRole("button", { name: "통계 새로고침" }));
  expect(
    await screen.findByText("이 달에 결제 완료한 내역이 없어요."),
  ).toBeTruthy();
  expect(getFixedCostDashboard).toHaveBeenLastCalledWith("2026-09", true);
});
test("새로고침 실패를 알리고 재시도하면 통계를 다시 표시한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue(FIXED_COST_FIXTURE);
  render(<Home />);
  await screen.findByRole("region", { name: "상위 분류별 지출 통계" });
  vi.mocked(getFixedCostDashboard).mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "통계 새로고침" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
  expect(
    await screen.findByRole("region", { name: "상위 분류별 지출 통계" }),
  ).toBeTruthy();
});
test("월별 막대를 선택하면 정확한 금액과 증감이 바뀌고 기록 없는 달도 확인한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue(FIXED_COST_FIXTURE);
  render(<Home />);
  const trend = within(
    await screen.findByRole("region", { name: "세부 분류별 월별 변화" }),
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
  expect(trend.getByText("10,000원 (22.2%)")).toBeTruthy();
});
test("미결제만 있는 달은 실제 지출과 증감 비교에서 제외한다", async () => {
  vi.mocked(getFixedCostDashboard).mockResolvedValue({
    ...FIXED_COST_FIXTURE,
    charges: [
      charge("pending", "2026-09", null),
      charge("paid", "2026-10", 10000),
    ],
  });
  render(<Home />);
  const trend = within(
    await screen.findByRole("region", { name: "세부 분류별 월별 변화" }),
  );
  expect(trend.getByText("비교 기록 없음")).toBeTruthy();
  fireEvent.click(trend.getByRole("button", { name: /2026년 9월, 기록 없음/ }));
  expect(trend.getByText("기록 없음")).toBeTruthy();
  expect(trend.queryByText(/미결제 \d+건/)).toBeNull();
});
