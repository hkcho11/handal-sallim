import IncomeFormScreen from "@/features/income/IncomeFormScreen";
import { validMonth } from "@/features/income/api";

export default async function NewIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  return (
    <IncomeFormScreen initialMonth={validMonth(month) ? month : undefined} />
  );
}
