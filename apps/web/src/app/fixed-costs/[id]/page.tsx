import FixedExpenseDetailScreen from "@/features/fixed-expenses/FixedExpenseDetailScreen";

export default async function FixedExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FixedExpenseDetailScreen key={id} id={id} />;
}
