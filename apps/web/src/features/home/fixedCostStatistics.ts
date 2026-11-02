export interface FixedCostCharge {
  id: string;
  recurringExpenseId: string;
  name: string;
  dueDate: string;
  expectedAmount: number | null;
  actualAmount: number | null;
  status: "예정" | "지연" | "완료";
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  plannedPaymentMethodId: string | null;
  paymentMethod: string | null;
  actualPaymentMethodId: string | null;
  actualPaymentMethod: string | null;
  actualPaidOn: string | null;
}
export interface FixedCostDashboard {
  month: string;
  asOf: string;
  months: string[];
  charges: FixedCostCharge[];
  classifications: Array<{
    categoryId: string;
    categoryName: string;
    subcategoryId: string;
    subcategoryName: string;
  }>;
  unscheduled: Array<{ id: string; name: string; expectedAmount: number }>;
}
export const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;
export const confirmedAmount = (charge: FixedCostCharge) =>
  charge.status === "완료" ? (charge.actualAmount ?? 0) : 0;
export const inMonth = (charge: FixedCostCharge, month: string) =>
  charge.dueDate.startsWith(`${month}-`);
export function categoryStatistics(data: FixedCostDashboard) {
  const charges = data.charges.filter((charge) => inMonth(charge, data.month));
  const completed = charges.filter((charge) => charge.status === "완료");
  const previousDate = new Date(`${data.month}-01T00:00:00Z`);
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const previousMonth = previousDate.toISOString().slice(0, 7);
  const categories = [...new Set(completed.map((charge) => charge.categoryId))]
    .map((id) => {
      const items = completed.filter((charge) => charge.categoryId === id);
      const actual = items.reduce(
        (sum, charge) => sum + confirmedAmount(charge),
        0,
      );
      const previous = data.charges.filter(
        (charge) =>
          inMonth(charge, previousMonth) &&
          charge.categoryId === id &&
          charge.status === "완료",
      );
      const previousAmount = previous.length
        ? previous.reduce((sum, charge) => sum + confirmedAmount(charge), 0)
        : null;
      const change = previousAmount === null ? null : actual - previousAmount;
      const percentage =
        change !== null && previousAmount !== null && previousAmount > 0
          ? (change / previousAmount) * 100
          : null;
      return {
        id,
        change,
        percentage,
        name: items[0].categoryName ?? "상위 분류 미지정",
        items,
        actual,
      };
    })
    .sort((a, b) => b.actual - a.actual);
  return {
    categories,
    charges,
    actual: categories.reduce((sum, c) => sum + c.actual, 0),
  };
}
export function monthlyChanges(
  data: FixedCostDashboard,
  subcategoryId: string | null,
  categoryId: string | null,
) {
  return data.months.map((month, index) => {
    const items = data.charges.filter(
      (charge) =>
        inMonth(charge, month) &&
        charge.subcategoryId === subcategoryId &&
        charge.categoryId === categoryId,
    );
    const previous = data.charges.filter(
      (charge) =>
        inMonth(charge, data.months[index - 1] ?? "") &&
        charge.subcategoryId === subcategoryId &&
        charge.categoryId === categoryId,
    );
    const amount = items.some((charge) => charge.status === "완료")
      ? items.reduce((sum, charge) => sum + confirmedAmount(charge), 0)
      : null;
    const previousAmount = previous.some((charge) => charge.status === "완료")
      ? previous.reduce((sum, charge) => sum + confirmedAmount(charge), 0)
      : null;
    const change =
      amount !== null && previousAmount !== null
        ? amount - previousAmount
        : null;
    const percentage =
      change !== null && previousAmount !== null && previousAmount > 0
        ? (change / previousAmount) * 100
        : null;
    return {
      month,
      amount,
      change,
      percentage,
      pendingCount: items.filter((charge) => charge.status !== "완료").length,
    };
  });
}
export function paymentStatistics(data: FixedCostDashboard) {
  const groups = new Map<
    string | null,
    {
      id: string | null;
      name: string;
      actual: number;
      completedCount: number;
    }
  >();
  for (const charge of data.charges.filter(
    (charge) => inMonth(charge, data.month) && charge.status === "완료",
  )) {
    const completed = charge.status === "완료";
    const id = completed
      ? charge.actualPaymentMethodId
      : charge.plannedPaymentMethodId;
    const name =
      (completed ? charge.actualPaymentMethod : charge.paymentMethod) ??
      "미지정";
    const group = groups.get(id) ?? {
      id,
      name,
      actual: 0,
      completedCount: 0,
    };
    if (completed) {
      group.actual += confirmedAmount(charge);
      group.completedCount++;
    }
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => b.actual - a.actual);
}
