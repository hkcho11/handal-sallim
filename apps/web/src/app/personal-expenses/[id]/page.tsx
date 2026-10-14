import PersonalExpenseDetail from "@/features/personal-expenses/PersonalExpenseDetail";

export default async function PersonalExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PersonalExpenseDetail key={id} id={id} />;
}
