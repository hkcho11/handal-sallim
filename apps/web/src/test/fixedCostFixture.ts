import type {
  FixedCostCharge,
  FixedCostDashboard,
} from "../features/home/fixedCostStatistics";
export const classification = {
  categoryId: "cat-utilities",
  categoryName: "공과금",
  subcategoryId: "sub-electric",
  subcategoryName: "전기",
};
export const charge = (
  id: string,
  month: string,
  amount: number | null,
  overrides: Partial<FixedCostCharge> = {},
): FixedCostCharge => ({
  id,
  recurringExpenseId: `expense-${id}`,
  name: "전기",
  dueDate: `${month}-10`,
  expectedAmount: 30000,
  actualAmount: amount,
  status: amount === null ? "예정" : "완료",
  ...classification,
  plannedPaymentMethodId: "planned",
  paymentMethod: "예정 카드",
  actualPaymentMethodId: amount === null ? null : "actual",
  actualPaymentMethod: amount === null ? null : "실제 계좌",
  actualPaidOn: amount === null ? null : `${month}-10`,
  ...overrides,
});
export const FIXED_COST_FIXTURE: FixedCostDashboard = {
  month: "2026-10",
  asOf: "2026-11-02",
  months: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
  charges: [
    charge("previous-a", "2026-09", 20000),
    charge("previous-b", "2026-09", 25000),
    charge("current", "2026-10", 55000, {
      expectedAmount: 60000,
      actualPaidOn: "2026-11-02",
    }),
    charge("pending", "2026-10", null, { expectedAmount: 15000 }),
    charge("rent", "2026-10", 100000, {
      categoryId: "cat-housing",
      categoryName: "주거",
      subcategoryId: "sub-rent",
      subcategoryName: "월세",
      name: "집 월세",
      expectedAmount: 100000,
    }),
    charge("unassigned", "2026-10", null, {
      categoryId: null,
      categoryName: null,
      subcategoryId: null,
      subcategoryName: null,
      name: "이전 미분류 고정비",
      expectedAmount: 30000,
      plannedPaymentMethodId: null,
      paymentMethod: null,
    }),
  ],
  classifications: [
    classification,
    {
      categoryId: "cat-utilities",
      categoryName: "공과금",
      subcategoryId: "sub-gas",
      subcategoryName: "가스",
    },
    {
      categoryId: "cat-housing",
      categoryName: "주거",
      subcategoryId: "sub-rent",
      subcategoryName: "월세",
    },
  ],
  unscheduled: [
    { id: "unscheduled", name: "일정 없는 보험", expectedAmount: 10000 },
  ],
};
