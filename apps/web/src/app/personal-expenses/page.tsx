import PersonalExpensesScreen from "@/features/personal-expenses/PersonalExpensesScreen";

export default async function PersonalExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const initialMonth =
    typeof month === "string" && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month)
      ? month
      : undefined;
  return <PersonalExpensesScreen initialMonth={initialMonth} />;
}
