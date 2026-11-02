import SavingsFormScreen from "@/features/savings/SavingsFormScreen";
export default async function EditSavingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SavingsFormScreen key={id} id={id} />;
}
