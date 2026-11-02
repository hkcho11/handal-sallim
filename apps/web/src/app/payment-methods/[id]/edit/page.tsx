import PaymentMethodScreen from "@/features/payment-methods/PaymentMethodScreen";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PaymentMethodScreen id={id} edit />;
}
