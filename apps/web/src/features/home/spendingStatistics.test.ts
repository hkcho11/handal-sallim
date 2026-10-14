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
  expect(statistics.spent).toBe(419000);
  expect(statistics.projected).toBe(1237000);
  expect(
    statistics.categories.reduce((sum, category) => sum + category.amount, 0),
  ).toBe(statistics.spent);
  expect(statistics.categories[0].name).toBe("식비");
});

test("개인 지출은 금액과 카테고리 목록에 영향을 주지 않는다", () => {
  const shared = MOCK_SPENDING_ENTRIES.filter(
    (entry) => entry.scope === "공동",
  );
  const personal = {
    id: "private",
    name: "개인 내역",
    date: "2026-10-14",
    amount: 9999999,
    category: "식비" as const,
    scope: "개인" as const,
  };
  expect(
    calculateSpendingStatistics([...shared, personal], 818000, "2026-10"),
  ).toEqual(calculateSpendingStatistics(shared, 818000, "2026-10"));
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
