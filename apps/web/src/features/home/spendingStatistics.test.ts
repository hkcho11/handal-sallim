import { expect, test } from "vitest";
import {
  calculateSpendingStatistics,
  MOCK_SPENDING_ENTRIES,
  mockCompletedEntries,
} from "./spendingStatistics";
import { MOCK_DASHBOARD, summarizeCharges } from "./mockDashboard";

test("완료된 고정비만 실제 금액으로 합산하며 예정액을 별도로 더한다", () => {
  const remaining = summarizeCharges(MOCK_DASHBOARD.charges).remaining;
  const statistics = calculateSpendingStatistics(
    MOCK_SPENDING_ENTRIES,
    remaining,
    "2026-10",
  );
  expect(mockCompletedEntries(MOCK_DASHBOARD.charges)).toHaveLength(2);
  expect(statistics.spent).toBe(545000);
  expect(statistics.projected).toBe(1363000);
  expect(
    statistics.categories.reduce((sum, category) => sum + category.amount, 0),
  ).toBe(statistics.spent);
  expect(statistics.categories[0].name).toBe("식비");
});

test("다른 달의 지출은 제외하고 빈 달의 비중을 0으로 표시한다", () => {
  const statistics = calculateSpendingStatistics(
    MOCK_SPENDING_ENTRIES,
    0,
    "2026-11",
  );
  expect(statistics.spent).toBe(0);
  expect(statistics.projected).toBe(0);
  expect(
    statistics.categories.every(
      (category) => category.share === 0 && category.items.length === 0,
    ),
  ).toBe(true);
});
