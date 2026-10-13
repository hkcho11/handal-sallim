import { type DashboardCharge, MOCK_DASHBOARD } from "./mockDashboard";

export const SPENDING_CATEGORIES = [
  "주거",
  "공과금",
  "식비",
  "교통",
  "구독",
  "기타",
] as const;
export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number];

export interface SpendingEntry {
  id: string;
  name: string;
  date: string;
  amount: number;
  category: SpendingCategory;
  scope: "공동" | "개인";
}

export const MOCK_GENERAL_EXPENSES: SpendingEntry[] = [
  {
    id: "groceries",
    name: "장보기",
    date: "2026-10-08",
    amount: 150000,
    category: "식비",
    scope: "공동",
  },
  {
    id: "meal",
    name: "식사",
    date: "2026-10-12",
    amount: 48000,
    category: "식비",
    scope: "개인",
  },
  {
    id: "transport-shared",
    name: "교통비",
    date: "2026-10-09",
    amount: 36000,
    category: "교통",
    scope: "공동",
  },
  {
    id: "transport-personal",
    name: "대중교통",
    date: "2026-10-11",
    amount: 36000,
    category: "교통",
    scope: "개인",
  },
  {
    id: "gas",
    name: "가스요금",
    date: "2026-10-06",
    amount: 34000,
    category: "공과금",
    scope: "공동",
  },
  {
    id: "household",
    name: "생활용품",
    date: "2026-10-10",
    amount: 64000,
    category: "기타",
    scope: "공동",
  },
  {
    id: "personal",
    name: "기타 지출",
    date: "2026-10-13",
    amount: 42000,
    category: "기타",
    scope: "개인",
  },
];

export function calculateSpendingStatistics(
  entries: SpendingEntry[],
  remainingFixedAmount: number,
  month: string,
) {
  const monthlyEntries = entries.filter((entry) =>
    entry.date.startsWith(`${month}-`),
  );
  const spent = monthlyEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const categories = SPENDING_CATEGORIES.map((name) => {
    const items = monthlyEntries.filter((entry) => entry.category === name);
    const amount = items.reduce((sum, entry) => sum + entry.amount, 0);
    return {
      name,
      items,
      amount,
      share: spent === 0 ? 0 : (amount / spent) * 100,
    };
  }).sort((a, b) => b.amount - a.amount);
  return { spent, projected: spent + remainingFixedAmount, categories };
}

const FIXED_CATEGORIES: Record<string, SpendingCategory> = {
  maintenance: "주거",
  subscription: "구독",
};

export function mockCompletedEntries(
  charges: DashboardCharge[],
): SpendingEntry[] {
  return charges
    .filter(
      (charge) => charge.status === "완료" && charge.actualAmount !== null,
    )
    .map((charge) => ({
      id: `fixed-${charge.id}`,
      name: charge.name,
      date: `2026-10-${String(charge.dueDay).padStart(2, "0")}`,
      amount: charge.actualAmount!,
      category: FIXED_CATEGORIES[charge.id] ?? "기타",
      scope: "공동",
    }));
}

export const MOCK_SPENDING_ENTRIES = [
  ...MOCK_GENERAL_EXPENSES,
  ...mockCompletedEntries(MOCK_DASHBOARD.charges),
];
