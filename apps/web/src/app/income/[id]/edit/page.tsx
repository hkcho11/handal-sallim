import IncomeFormScreen from "@/features/income/IncomeFormScreen";
import { validMonth } from "@/features/income/api";

export default async function EditIncomePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ id }, { month }] = await Promise.all([params, searchParams]);
  return (
    <IncomeFormScreen
      key={id}
      id={id}
      initialMonth={validMonth(month) ? month : undefined}
    />
  );
}
