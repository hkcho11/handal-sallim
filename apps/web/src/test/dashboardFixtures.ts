import { type DashboardCharge } from "../features/home/dashboard";
import type { DashboardResponse } from "../features/home/dashboard";
import {
  type SpendingEntry,
  type SpendingCategory,
} from "../features/home/spendingStatistics";
export { summarizeCharges } from "../features/home/dashboard";
export const MOCK_DASHBOARD = {
  month: "2026년 10월",
  referenceDate: "10월 13일 기준",
  charges: [
    {
      id: "electricity",
      name: "전기요금",
      dueDay: 10,
      expectedAmount: 48000,
      actualAmount: null,
      payer: "나",
      paymentMethod: "생활비 계좌",
      status: "지연",
    },
    {
      id: "rent",
      name: "월세",
      dueDay: 15,
      expectedAmount: 650000,
      actualAmount: null,
      payer: "나",
      paymentMethod: "생활비 계좌",
      status: "예정",
    },
    {
      id: "internet",
      name: "인터넷",
      dueDay: 18,
      expectedAmount: 35000,
      actualAmount: null,
      payer: "함께 관리하는 사람",
      paymentMethod: "생활비 카드",
      status: "예정",
    },
    {
      id: "insurance",
      name: "보험료",
      dueDay: 25,
      expectedAmount: 85000,
      actualAmount: null,
      payer: null,
      paymentMethod: null,
      status: "예정",
    },
    {
      id: "subscription",
      name: "영상 구독",
      dueDay: 5,
      expectedAmount: 17000,
      actualAmount: 17000,
      payer: "나",
      paymentMethod: "생활비 카드",
      status: "완료",
    },
    {
      id: "maintenance",
      name: "관리비",
      dueDay: 7,
      expectedAmount: 120000,
      actualAmount: 118000,
      payer: "함께 관리하는 사람",
      paymentMethod: "생활비 계좌",
      status: "완료",
    },
  ] satisfies DashboardCharge[],
  finances: [
    { name: "공동 생활비", income: 3000000, otherExpenses: 284000 },
    { name: "내 개인 내역", income: 450000, otherExpenses: 126000 },
  ],
};

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

export const DASHBOARD_FIXTURE: DashboardResponse = {
  month: "2026-10",
  asOf: "2026-10-14",
  entries: MOCK_SPENDING_ENTRIES.filter((entry) => entry.scope === "공동").map(
    (entry) => ({
      ...entry,
      paymentMethod:
        entry.id === "fixed-maintenance" ? "생활비 계좌" : "생활비 카드",
    }),
  ),
  charges: MOCK_DASHBOARD.charges.map((charge) => ({
    ...charge,
    dueDate: `2026-10-${String(charge.dueDay).padStart(2, "0")}`,
  })),
};
