import { apiFetch } from "../../shared/api/apiFetch";
import { SERVICE_UNAVAILABLE_MESSAGE } from "../../shared/api/serviceAvailability";

export interface FixedExpense {
  id: string;
  name: string;
  expectedAmount: number;
  intervalMonths: 1 | 2 | 3 | 12 | null;
  recurringDayOfMonth: number | null;
  firstDueDate: string | null;
  firstChargeId: string | null;
  firstChargeStatus: "PENDING" | "OVERDUE" | "COMPLETED" | null;
  firstChargeDueDate?: string | null;
  payer: "ME" | "PARTNER" | null;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  subcategoryId?: string | null;
  subcategoryName?: string | null;
  memo?: string | null;
}

export interface NewFixedExpense {
  memo: string | null;
  subcategoryId: string;
  expectedAmount: number;
  intervalMonths: Exclude<FixedExpense["intervalMonths"], null> | null;
  recurringDayOfMonth: number | null;
  firstDueDate: string | null;
  payer: FixedExpense["payer"];
  paymentMethodId: string | null;
  categoryId: string;
}

export interface FixedExpenseFormOptions {
  categories?: Array<{ id: string; name: string }>;
  subcategories?: Array<{ id: string; categoryId: string; name: string }>;
  payers: Array<{ value: "ME" | "PARTNER"; label: string }>;
  paymentMethods: Array<{
    id: string;
    name: string;
    type: "CARD" | "ACCOUNT" | "CASH";
  }>;
}

export class FixedExpenseApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isFixedExpense(value: unknown): value is FixedExpense {
  if (!isObject(value)) return false;
  return (
    isUuid(value.id) &&
    typeof value.name === "string" &&
    Number.isSafeInteger(value.expectedAmount) &&
    Number(value.expectedAmount) > 0 &&
    (value.intervalMonths === null ||
      [1, 2, 3, 12].includes(Number(value.intervalMonths))) &&
    (value.recurringDayOfMonth === null ||
      (Number.isInteger(Number(value.recurringDayOfMonth)) &&
        Number(value.recurringDayOfMonth) >= 1 &&
        Number(value.recurringDayOfMonth) <= 31)) &&
    (value.firstDueDate === null || isIsoDate(value.firstDueDate)) &&
    (value.firstChargeDueDate === undefined ||
      value.firstChargeDueDate === null ||
      isIsoDate(value.firstChargeDueDate)) &&
    (value.firstChargeId === null || isUuid(value.firstChargeId)) &&
    (value.firstChargeStatus === null ||
      ["PENDING", "OVERDUE", "COMPLETED"].includes(
        String(value.firstChargeStatus),
      )) &&
    (value.payer === null || ["ME", "PARTNER"].includes(String(value.payer))) &&
    (value.categoryId === undefined ||
      value.categoryId === null ||
      isUuid(value.categoryId)) &&
    (value.categoryName === undefined ||
      value.categoryName === null ||
      typeof value.categoryName === "string") &&
    (value.subcategoryId === undefined ||
      value.subcategoryId === null ||
      isUuid(value.subcategoryId)) &&
    (value.subcategoryName === undefined ||
      value.subcategoryName === null ||
      typeof value.subcategoryName === "string") &&
    (value.memo === undefined ||
      value.memo === null ||
      (typeof value.memo === "string" && value.memo.length <= 120)) &&
    (value.paymentMethodId === null || isUuid(value.paymentMethodId)) &&
    (value.paymentMethodName === null ||
      typeof value.paymentMethodName === "string")
  );
}

async function readResult(response: Response): Promise<unknown> {
  if (!response.ok) {
    const messages: Record<number, string> = {
      503: SERVICE_UNAVAILABLE_MESSAGE,
      400: "입력값을 확인해 주세요.",
      401: "로그인이 필요합니다.",
      403: "사용할 수 있는 공간이 없습니다.",
      404: "고정비를 찾을 수 없습니다.",
      409: "이미 다른 내용으로 저장된 요청입니다. 내용을 확인하고 다시 저장해 주세요.",
    };
    throw new FixedExpenseApiError(
      response.status,
      messages[response.status] ??
        "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new FixedExpenseApiError(
      0,
      "응답을 확인할 수 없습니다. 다시 시도해 주세요.",
    );
  }
}

export async function listFixedExpenses(): Promise<FixedExpense[]> {
  let response: Response;
  try {
    response = await apiFetch("/backend/recurring-expenses", {
      credentials: "same-origin",
    });
  } catch {
    throw new FixedExpenseApiError(
      0,
      "연결할 수 없습니다. 네트워크를 확인하고 다시 시도해 주세요.",
    );
  }
  const data = await readResult(response);
  if (!Array.isArray(data) || !data.every(isFixedExpense)) {
    throw new FixedExpenseApiError(
      0,
      "목록 응답을 확인할 수 없습니다. 다시 시도해 주세요.",
    );
  }
  return data;
}

export async function getFixedExpenseFormOptions(): Promise<FixedExpenseFormOptions> {
  let response: Response;
  try {
    response = await apiFetch("/backend/recurring-expenses/options", {
      credentials: "same-origin",
    });
  } catch {
    throw new FixedExpenseApiError(
      0,
      "연결할 수 없습니다. 네트워크를 확인하고 다시 시도해 주세요.",
    );
  }
  const data = await readResult(response);
  if (
    !isObject(data) ||
    !Array.isArray(data.payers) ||
    !Array.isArray(data.paymentMethods)
  ) {
    throw new FixedExpenseApiError(0, "입력 선택지를 확인할 수 없습니다.");
  }
  const payers = data.payers.every(
    (item) =>
      isObject(item) &&
      ["ME", "PARTNER"].includes(String(item.value)) &&
      typeof item.label === "string",
  );
  const paymentMethods = data.paymentMethods.every(
    (item) =>
      isObject(item) &&
      isUuid(item.id) &&
      typeof item.name === "string" &&
      ["CARD", "ACCOUNT", "CASH"].includes(String(item.type)),
  );
  const categories =
    data.categories === undefined ||
    (Array.isArray(data.categories) &&
      data.categories.every(
        (item) =>
          isObject(item) && isUuid(item.id) && typeof item.name === "string",
      ));
  const subcategories =
    data.subcategories === undefined ||
    (Array.isArray(data.subcategories) &&
      data.subcategories.every(
        (item) =>
          isObject(item) &&
          isUuid(item.id) &&
          isUuid(item.categoryId) &&
          typeof item.name === "string" &&
          Array.isArray(data.categories) &&
          data.categories.some(
            (category: unknown) =>
              isObject(category) && category.id === item.categoryId,
          ),
      ));
  if (!payers || !paymentMethods || !categories || !subcategories) {
    throw new FixedExpenseApiError(0, "입력 선택지를 확인할 수 없습니다.");
  }
  return data as unknown as FixedExpenseFormOptions;
}

export async function createFixedExpense(
  input: NewFixedExpense,
  idempotencyKey: string,
): Promise<FixedExpense> {
  let response: Response;
  try {
    response = await apiFetch("/backend/recurring-expenses", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new FixedExpenseApiError(
      0,
      "연결할 수 없습니다. 다시 저장해 주세요.",
    );
  }
  const data = await readResult(response);
  if (!isFixedExpense(data)) {
    throw new FixedExpenseApiError(
      0,
      "저장 결과를 확인할 수 없습니다. 다시 시도해 주세요.",
    );
  }
  return data;
}

export async function completeFixedExpenseSchedule(
  id: string,
  intervalMonths: Exclude<FixedExpense["intervalMonths"], null>,
  recurringDayOfMonth: number,
  firstDueDate: string,
): Promise<FixedExpense> {
  let response: Response;
  try {
    response = await apiFetch(`/backend/recurring-expenses/${id}/schedule`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intervalMonths,
        recurringDayOfMonth,
        firstDueDate,
      }),
    });
  } catch {
    throw new FixedExpenseApiError(
      0,
      "연결할 수 없습니다. 다시 저장해 주세요.",
    );
  }
  const data = await readResult(response);
  if (!isFixedExpense(data)) {
    throw new FixedExpenseApiError(0, "저장 응답을 확인할 수 없습니다.");
  }
  return data;
}

export async function updateFixedExpense(
  id: string,
  input: NewFixedExpense,
): Promise<FixedExpense> {
  let response: Response;
  try {
    response = await apiFetch(
      `/backend/recurring-expenses/${encodeURIComponent(id)}/details`,
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
  } catch {
    throw new FixedExpenseApiError(
      0,
      "연결할 수 없습니다. 다시 저장해 주세요.",
    );
  }
  const data = await readResult(response);
  if (!isFixedExpense(data))
    throw new FixedExpenseApiError(0, "저장 응답을 확인할 수 없습니다.");
  return data;
}

export async function deleteFixedExpense(id: string): Promise<void> {
  let response: Response;
  try {
    response = await apiFetch(
      `/backend/recurring-expenses/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        credentials: "same-origin",
      },
    );
  } catch {
    throw new FixedExpenseApiError(
      0,
      "연결할 수 없습니다. 다시 시도해 주세요.",
    );
  }
  if (!response.ok) await readResult(response);
}

export async function addFixedExpenseCategory(
  name: string,
): Promise<{ id: string; name: string }> {
  let response: Response;
  try {
    response = await apiFetch("/backend/recurring-expenses/categories", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch {
    throw new FixedExpenseApiError(
      0,
      "연결할 수 없습니다. 다시 시도해 주세요.",
    );
  }
  const data = await readResult(response);
  if (!isObject(data) || !isUuid(data.id) || typeof data.name !== "string")
    throw new FixedExpenseApiError(0, "카테고리 응답을 확인할 수 없습니다.");
  return { id: data.id, name: data.name };
}

export async function addFixedExpenseSubcategory(
  categoryId: string,
  name: string,
): Promise<{ id: string; categoryId: string; name: string }> {
  let response: Response;
  try {
    response = await apiFetch("/backend/recurring-expenses/subcategories", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, name }),
    });
  } catch {
    throw new FixedExpenseApiError(
      0,
      "연결할 수 없습니다. 다시 시도해 주세요.",
    );
  }
  const data = await readResult(response);
  if (
    !isObject(data) ||
    !isUuid(data.id) ||
    data.categoryId !== categoryId ||
    typeof data.name !== "string"
  )
    throw new FixedExpenseApiError(0, "중분류 응답을 확인할 수 없습니다.");
  return { id: data.id, categoryId, name: data.name };
}
