import { expect, test } from "vitest";
import {
  FIXED_COST_FIXTURE as data,
  charge,
} from "../../test/fixedCostFixture";
import {
  categoryStatistics,
  monthlyChanges,
  monthlySummary,
  paymentStatistics,
} from "./fixedCostStatistics";
test("월 요약은 실제 지출과 미결제 예정액을 분리하고 완료 건수와 지연을 센다", () => {
  expect(monthlySummary(data)).toEqual({
    count: 4,
    completedCount: 2,
    pendingCount: 2,
    overdueCount: 0,
    actual: 155000,
    expected: 205000,
    remaining: 45000,
  });
  expect(
    monthlySummary({
      ...data,
      charges: [
        ...data.charges,
        charge("overdue", data.month, null, { status: "지연" }),
      ],
    }),
  ).toMatchObject({ overdueCount: 1, pendingCount: 3, remaining: 75000 });
});
test("빈 달과 미결제만 있는 달을 완료한 달로 표시하지 않는다", () => {
  expect(monthlySummary({ ...data, charges: [] })).toEqual({
    count: 0,
    completedCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    actual: 0,
    expected: 0,
    remaining: 0,
  });
  expect(
    monthlySummary({ ...data, charges: [charge("pending", data.month, null)] }),
  ).toMatchObject({
    count: 1,
    completedCount: 0,
    pendingCount: 1,
    actual: 0,
    remaining: 30000,
  });
});
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
