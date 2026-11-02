import SavingsDetailScreen from "@/features/savings/SavingsDetailScreen";
export default async function SavingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SavingsDetailScreen key={id} id={id} />;
}
