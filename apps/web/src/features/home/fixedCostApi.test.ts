import { afterEach, expect, test, vi } from "vitest";
import { FIXED_COST_FIXTURE } from "../../test/fixedCostFixture";
import { getFixedCostDashboard, validFixedCostDashboard } from "./fixedCostApi";
afterEach(() => vi.unstubAllGlobals());
test("고정비 응답과 선택 월을 검증한다", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(FIXED_COST_FIXTURE)));
  vi.stubGlobal("fetch", fetcher);
  expect(await getFixedCostDashboard("2026-10")).toEqual(FIXED_COST_FIXTURE);
  expect(fetcher.mock.calls[0][0]).toBe(
    "/backend/dashboard/fixed-costs?month=2026-10",
  );
});
test("잘못된 완료 금액·월 범위·중복 청구를 거부한다", () => {
  expect(
    validFixedCostDashboard({
      ...FIXED_COST_FIXTURE,
      charges: [{ ...FIXED_COST_FIXTURE.charges[2], actualAmount: null }],
    }),
  ).toBe(false);
  expect(
    validFixedCostDashboard({
      ...FIXED_COST_FIXTURE,
      months: [...FIXED_COST_FIXTURE.months].reverse(),
    }),
  ).toBe(false);
  expect(
    validFixedCostDashboard({
      ...FIXED_COST_FIXTURE,
      charges: [FIXED_COST_FIXTURE.charges[0], FIXED_COST_FIXTURE.charges[0]],
    }),
  ).toBe(false);
});
