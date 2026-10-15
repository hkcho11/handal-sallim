import { expect, test } from "vitest";
import {
  FIXED_COST_FIXTURE as data,
  charge,
} from "../../test/fixedCostFixture";
import {
  categoryStatistics,
  monthlyChanges,
  paymentStatistics,
} from "./fixedCostStatistics";
test("대분류 ID로 고정비만 묶고 일정 미정과 다른 달을 합산하지 않는다", () => {
  const stats = categoryStatistics(data);
  expect(stats.actual).toBe(155000);
  expect(stats.expected).toBe(205000);
  expect(stats.categories.find((c) => c.id === "cat-utilities")?.actual).toBe(
    55000,
  );
});
test("늦게 결제해도 예정월에 합산하고 미결제 0원과 기록 없는 달을 구분한다", () => {
  const points = monthlyChanges(data, "sub-electric", "cat-utilities");
  expect(points[0].amount).toBeNull();
  expect(points[4].amount).toBe(45000);
  expect(points[5]).toMatchObject({
    amount: 55000,
    change: 10000,
    pendingCount: 1,
  });
  expect(points[5].percentage).toBeCloseTo(22.222);
  expect(
    monthlyChanges(
      {
        ...data,
        charges: [
          charge("zero", "2026-09", null),
          charge("actual", "2026-10", 1000),
        ],
      },
      "sub-electric",
      "cat-utilities",
    )[5],
  ).toMatchObject({ change: 1000, percentage: null });
});
test("실제 결제수단과 예정 결제수단을 나누고 미지정을 별도 집계한다", () => {
  const methods = paymentStatistics(data);
  expect(methods.find((m) => m.id === "actual")).toMatchObject({
    actual: 155000,
    planned: 0,
  });
  expect(methods.find((m) => m.id === "planned")).toMatchObject({
    actual: 0,
    planned: 15000,
  });
  expect(methods.find((m) => m.id === null)).toMatchObject({
    actual: 0,
    planned: 30000,
  });
});
test("같은 중분류 표시명이라도 ID가 다르면 섞지 않는다", () => {
  const other = charge("other", "2026-10", 99999, {
    subcategoryId: "other-electric",
  });
  expect(
    monthlyChanges(
      { ...data, charges: [...data.charges, other] },
      "sub-electric",
      "cat-utilities",
    )[5].amount,
  ).toBe(55000);
});
