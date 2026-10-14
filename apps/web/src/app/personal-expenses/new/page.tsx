import PersonalExpenseForm from "@/features/personal-expenses/PersonalExpenseForm";

export const dynamic = "force-dynamic";

export default function NewPersonalExpensePage() {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return <PersonalExpenseForm initialDate={today} />;
}
