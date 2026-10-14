export type SpendingCategory = string;
export interface SpendingEntry {
  id: string;
  name: string;
  date: string;
  amount: number;
  category: SpendingCategory;
  scope: "공동" | "개인";
  paymentMethod?: string;
}
export function selectHomeSpendingEntries(
  entries: SpendingEntry[],
  month: string,
) {
  return entries.filter(
    (entry) => entry.scope === "공동" && entry.date.startsWith(`${month}-`),
  );
}
export function calculateSpendingStatistics(
  entries: SpendingEntry[],
  remainingFixedAmount: number,
  month: string,
) {
  const monthlyEntries = selectHomeSpendingEntries(entries, month);
  const spent = monthlyEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const categories = [...new Set(monthlyEntries.map((entry) => entry.category))]
    .map((name) => {
      const items = monthlyEntries.filter((entry) => entry.category === name);
      const amount = items.reduce((sum, entry) => sum + entry.amount, 0);
      return {
        name,
        items,
        amount,
        share: spent === 0 ? 0 : (amount / spent) * 100,
      };
    })
    .sort((a, b) => b.amount - a.amount);
  return { spent, projected: spent + remainingFixedAmount, categories };
}
