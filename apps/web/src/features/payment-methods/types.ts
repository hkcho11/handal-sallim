export const typeLabels = {
  CREDIT_CARD: "신용카드",
  DEBIT_CARD: "체크카드",
  SIMPLE_PAY: "간편결제",
  ACCOUNT: "계좌",
  CASH: "현금",
  CARD: "카드(미분류)",
} as const;

export type PaymentMethodType = keyof typeof typeLabels;

export function isPaymentMethodType(
  value: unknown,
): value is PaymentMethodType {
  return typeof value === "string" && Object.hasOwn(typeLabels, value);
}

export function comparePaymentMethodNames(
  a: { id: string; name: string },
  b: { id: string; name: string },
) {
  return a.name.localeCompare(b.name, "ko-KR") || a.id.localeCompare(b.id);
}
