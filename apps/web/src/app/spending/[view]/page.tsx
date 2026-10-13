import { notFound } from "next/navigation";
import SpendingDetails from "../../../features/home/SpendingDetails";

export function generateStaticParams() {
  return ["actual", "remaining", "projected"].map((view) => ({ view }));
}

export default async function SpendingPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (view !== "actual" && view !== "remaining" && view !== "projected")
    notFound();
  return <SpendingDetails view={view} />;
}
