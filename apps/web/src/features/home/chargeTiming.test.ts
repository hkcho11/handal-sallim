import { expect, test } from "vitest";
import { charge } from "../../test/fixedCostFixture";
import { chargeTiming } from "./chargeTiming";

test.each([
  ["2026-10-20", "2026-10-15", "D-5 · 5일 남음"],
  ["2026-10-12", "2026-10-15", "D+3 · 3일 지연"],
  ["2026-10-15", "2026-10-15", "D-Day · 오늘 결제"],
  ["2027-01-01", "2026-12-31", "D-1 · 1일 남음"],
  ["2028-02-29", "2028-03-01", "D+1 · 1일 지연"],
])(
  "예정 결제일 %s와 기준일 %s의 일수를 표시한다",
  (dueDate, asOf, expected) => {
    expect(
      chargeTiming(charge("test", "2026-10", null, { dueDate }), asOf),
    ).toBe(`결제 예정일 ${dueDate} · ${expected}`);
  },
);
test("완료한 청구는 지연일 대신 실제 결제일을 표시한다", () => {
  expect(
    chargeTiming(
      charge("paid", "2026-10", 10000, { actualPaidOn: "2026-11-02" }),
      "2026-11-05",
    ),
  ).toBe("결제일 2026-11-02");
});
