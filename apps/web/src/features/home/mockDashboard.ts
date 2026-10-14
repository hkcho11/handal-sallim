export interface DashboardCharge {
  id: string;
  name: string;
  dueDay: number;
  expectedAmount: number;
  actualAmount: number | null;
  payer: string | null;
  paymentMethod: string | null;
  status: "예정" | "완료" | "지연";
}

// 실제 내역과 독립된 화면 미리보기용 데이터. 날짜와 상태도 같은 기준일에 고정한다.
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

export function summarizeCharges(charges: DashboardCharge[]) {
  const pending = charges.filter((charge) => charge.status !== "완료");
  const completed = charges.filter((charge) => charge.status === "완료");
  return {
    expected: charges.reduce((sum, charge) => sum + charge.expectedAmount, 0),
    confirmed: completed.reduce(
      (sum, charge) => sum + (charge.actualAmount ?? 0),
      0,
    ),
    remaining: pending.reduce((sum, charge) => sum + charge.expectedAmount, 0),
    pendingCount: pending.length,
    overdueCount: charges.filter((charge) => charge.status === "지연").length,
    completedCount: completed.length,
  };
}
