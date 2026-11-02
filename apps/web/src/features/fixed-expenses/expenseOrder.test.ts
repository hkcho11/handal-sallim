import { expect, test, vi } from "vitest";
import type { FixedExpense } from "./api";
import {
  compareFixedExpenses,
  overdueStatus,
  paymentDate,
  todayInSeoul,
} from "./expenseOrder";

function item(
  id: string,
  status: FixedExpense["firstChargeStatus"],
  date: string | null,
) {
  return {
    id,
    firstChargeStatus: status,
    firstDueDate: "2026-01-01",
    firstChargeDueDate: date,
  };
}

test("지연 → 예정 → 완료 → 일정 미정 순으로 묶고 각 그룹은 실제 회차 결제일 오름차순이다", () => {
  const items = [
    item("완료 늦음", "COMPLETED", "2026-10-14"),
    item("예정 늦음", "PENDING", "2026-11-01"),
    item("미정", null, null),
    item("지연 최근", "OVERDUE", "2026-10-14"),
    item("완료 빠름", "COMPLETED", "2026-10-01"),
    item("예정 가까움", "PENDING", "2026-10-15"),
    item("지연 오래됨", "OVERDUE", "2026-10-01"),
  ];
  expect(items.sort(compareFixedExpenses).map((value) => value.id)).toEqual([
    "지연 오래됨",
    "지연 최근",
    "예정 가까움",
    "예정 늦음",
    "완료 빠름",
    "완료 늦음",
    "미정",
  ]);
});

test("지연 일수는 첫 결제일이 아닌 실제 회차 날짜를 기준으로 계산한다", () => {
  expect(
    overdueStatus(item("전기", "OVERDUE", "2026-10-12"), "2026-10-15"),
  ).toBe("지연 · D+3");
  expect(paymentDate(item("미정", null, null))).toBeNull();
});

test("지연 일수는 월과 윤년 경계에서도 일 단위로 계산한다", () => {
  expect(
    overdueStatus(item("전기", "OVERDUE", "2028-02-29"), "2028-03-01"),
  ).toBe("지연 · D+1");
});

test("현재 날짜는 한국 자정을 기준으로 바뀐다", () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-10-14T14:59:00Z"));
    expect(todayInSeoul()).toBe("2026-10-14");
    vi.setSystemTime(new Date("2026-10-14T15:00:00Z"));
    expect(todayInSeoul()).toBe("2026-10-15");
  } finally {
    vi.useRealTimers();
  }
});
