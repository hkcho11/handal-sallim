import { afterEach, expect, test, vi } from "vitest";
import { listFixedExpenses } from "../../features/fixed-expenses/api";
import { getFixedCostDashboard } from "../../features/home/fixedCostApi";
import { listIncomes } from "../../features/income/api";
import { listSavings } from "../../features/savings/api";
import { listPaymentMethods } from "../../features/payment-methods/api";
import { listOwners } from "./owners";
import { SERVICE_UNAVAILABLE_MESSAGE } from "./serviceAvailability";

afterEach(() => vi.unstubAllGlobals());

test.each([
  ["home", () => getFixedCostDashboard()],
  ["expenses", () => listFixedExpenses()],
  ["income", () => listIncomes("2026-10")],
  ["savings", () => listSavings()],
  ["payment methods", () => listPaymentMethods()],
  ["owners", () => listOwners("incomes")],
] as const)(
  "%s explains temporary backend unavailability",
  async (_name, load) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    await expect(load()).rejects.toThrow(SERVICE_UNAVAILABLE_MESSAGE);
  },
);
