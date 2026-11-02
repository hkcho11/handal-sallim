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
  expect(
    stats.categories.every((c) =>
      c.items.every((item) => item.status === "완료"),
    ),
  ).toBe(true);
  expect(stats.categories.find((c) => c.id === "cat-utilities")?.actual).toBe(
    55000,
  );
});

test("등록 금액이 달라도 완료 금액 기준으로만 분류를 정렬한다", () => {
  const differing = {
    ...data,
    charges: data.charges.map((item) =>
      item.id === "current" ? { ...item, expectedAmount: 600000 } : item,
    ),
  };
  expect(
    categoryStatistics(differing).categories.map((category) => category.id),
  ).toEqual(["cat-housing", "cat-utilities"]);
  expect(
    categoryStatistics(differing).categories.map((category) => category.id),
  ).toEqual(["cat-housing", "cat-utilities"]);
});
test("늦게 결제해도 예정월에 합산하고 미결제만 있으면 비교 금액을 만들지 않는다", () => {
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
  ).toMatchObject({ change: null, percentage: null });
});
test("실제 결제수단으로만 집계하고 미결제 예정 수단은 제외한다", () => {
  const methods = paymentStatistics(data);
  expect(methods.find((m) => m.id === "actual")).toMatchObject({
    actual: 155000,
    completedCount: 2,
  });
  expect(methods.find((m) => m.id === "planned")).toBeUndefined();
  expect(methods.find((m) => m.id === null)).toBeUndefined();
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

test("대분류 전월 비교는 세부 분류를 합산하고 증가·감소·동일 금액을 구분한다", () => {
  for (const [actual, change, percentage] of [
    [60000, 15000, (15000 / 45000) * 100],
    [30000, -15000, (-15000 / 45000) * 100],
    [45000, 0, 0],
  ]) {
    const result = categoryStatistics({
      ...data,
      charges: [
        charge("a", "2026-09", 20000),
        charge("b", "2026-09", 25000, { subcategoryId: "sub-gas" }),
        charge("current", "2026-10", actual),
        charge("pending", "2026-10", null),
      ],
    }).categories[0];
    expect(result.change).toBe(change);
    expect(result.percentage).toBeCloseTo(percentage);
  }
});

test("대분류 비교는 전월 기록 없음·미결제·0원을 구분하고 연도 경계를 처리한다", () => {
  for (const previous of [
    [],
    [charge("pending", "2025-12", null)],
    [charge("zero", "2025-12", 0)],
  ]) {
    const result = categoryStatistics({
      ...data,
      month: "2026-01",
      charges: [...previous, charge("current", "2026-01", 10000)],
    }).categories[0];
    expect(result.change).toBe(previous[0]?.status === "완료" ? 10000 : null);
    expect(result.percentage).toBeNull();
  }
  const result = categoryStatistics({
    ...data,
    month: "2026-01",
    charges: [
      charge("previous", "2025-12", 20000),
      charge("current", "2026-01", 10000),
    ],
  }).categories[0];
  expect(result).toMatchObject({ change: -10000, percentage: -50 });
});
