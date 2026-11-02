import IncomeScreen from "@/features/income/IncomeScreen";
import { validMonth } from "@/features/income/api";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  return (
    <IncomeScreen
      key={month ?? "current"}
      initialMonth={validMonth(month) ? month : undefined}
    />
  );
}
