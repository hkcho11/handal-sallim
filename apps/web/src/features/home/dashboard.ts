export interface DashboardCharge {
  id: string;
  name: string;
  dueDay: number;
  dueDate?: string;
  expectedAmount: number;
  actualAmount: number | null;
  payer: string | null;
  paymentMethod: string | null;
  status: "예정" | "완료" | "지연";
}

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

export interface DashboardResponse {
  month: string;
  asOf: string;
  entries: import("./spendingStatistics").SpendingEntry[];
  charges: DashboardCharge[];
}
