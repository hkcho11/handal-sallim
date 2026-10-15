import type { FixedCostCharge } from "./fixedCostStatistics";

export function chargeTiming(charge: FixedCostCharge, asOf: string) {
  if (charge.status === "완료")
    return `결제일 ${charge.actualPaidOn ?? charge.dueDate}`;
  const days = Math.round(
    (Date.parse(`${charge.dueDate}T00:00:00Z`) -
      Date.parse(`${asOf}T00:00:00Z`)) /
      86400000,
  );
  return `결제 예정일 ${charge.dueDate} · ${days < 0 ? `D+${-days} · ${-days}일 지연` : days > 0 ? `D-${days} · ${days}일 남음` : "D-Day · 오늘 결제"}`;
}
