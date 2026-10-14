export interface PersonalExpense {
  id: string;
  name: string;
  amount: number;
  occurredOn: string;
  categoryId: string;
  categoryName: string;
  paymentMethodId: string;
  paymentMethodName: string;
  memo: string | null;
  version: number;
}

export interface PersonalExpenseInput {
  name: string;
  amount: number;
  occurredOn: string;
  categoryId: string;
  paymentMethodId: string;
  memo: string | null;
  privateConfirmed: boolean;
}

export interface PersonalExpenseMonth {
  month: string;
  totalAmount: string;
  items: PersonalExpense[];
}

export interface ExpenseOption {
  id: string;
  name: string;
}
export interface PersonalExpenseOptions {
  sharedSpace: boolean;
  categories: ExpenseOption[];
  paymentMethods: ExpenseOption[];
}

export class PersonalExpenseApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function uuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}
function expense(value: unknown): value is PersonalExpense {
  return (
    object(value) &&
    uuid(value.id) &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.amount === "number" &&
    Number.isSafeInteger(value.amount) &&
    value.amount > 0 &&
    isDate(value.occurredOn) &&
    uuid(value.categoryId) &&
    typeof value.categoryName === "string" &&
    uuid(value.paymentMethodId) &&
    typeof value.paymentMethodName === "string" &&
    (value.memo === null || typeof value.memo === "string") &&
    typeof value.version === "number" &&
    Number.isSafeInteger(value.version) &&
    value.version >= 0
  );
}
function option(value: unknown): value is ExpenseOption {
  return object(value) && uuid(value.id) && typeof value.name === "string";
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/backend/personal-expenses${path}`, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new PersonalExpenseApiError(
      0,
      "연결할 수 없습니다. 다시 시도해 주세요.",
    );
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: "입력값을 확인해 주세요.",
      401: "로그인이 필요합니다.",
      403: "사용할 수 있는 공간이 없습니다.",
      404: "지출을 찾을 수 없습니다.",
      409: "내역이 변경되었거나 이전 저장 요청과 다릅니다. 최신 내역을 확인해 주세요.",
    };
    throw new PersonalExpenseApiError(
      response.status,
      messages[response.status] ??
        "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
    );
  }
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new PersonalExpenseApiError(
      0,
      "응답을 확인할 수 없습니다. 다시 시도해 주세요.",
    );
  }
}
function invalid(): never {
  throw new PersonalExpenseApiError(
    0,
    "응답을 확인할 수 없습니다. 다시 시도해 주세요.",
  );
}

export async function listPersonalExpenses(
  month: string,
): Promise<PersonalExpenseMonth> {
  const result = await request(`?month=${encodeURIComponent(month)}`);
  if (
    !object(result) ||
    result.month !== month ||
    typeof result.totalAmount !== "string" ||
    !/^(0|[1-9]\d*)$/.test(result.totalAmount) ||
    !Array.isArray(result.items) ||
    !result.items.every(expense)
  )
    return invalid();
  if (
    result.items.some((item) => item.occurredOn.slice(0, 7) !== month) ||
    new Set(result.items.map((item) => item.id)).size !== result.items.length ||
    result.items
      .reduce((sum, item) => sum + BigInt(item.amount), BigInt(0))
      .toString() !== result.totalAmount
  )
    return invalid();
  return { month, totalAmount: result.totalAmount, items: result.items };
}
export async function getPersonalExpense(id: string): Promise<PersonalExpense> {
  const result = await request(`/${encodeURIComponent(id)}`);
  if (!expense(result) || result.id !== id) return invalid();
  return result;
}
export async function personalExpenseOptions(): Promise<PersonalExpenseOptions> {
  const result = await request("/options");
  if (
    !object(result) ||
    typeof result.sharedSpace !== "boolean" ||
    !Array.isArray(result.categories) ||
    !result.categories.every(option) ||
    !Array.isArray(result.paymentMethods) ||
    !result.paymentMethods.every(option)
  )
    return invalid();
  return {
    sharedSpace: result.sharedSpace,
    categories: result.categories,
    paymentMethods: result.paymentMethods,
  };
}
export async function savePersonalExpense(
  input: PersonalExpenseInput,
  key: string,
  current?: PersonalExpense,
): Promise<PersonalExpense> {
  const result = await request(
    current ? `/${encodeURIComponent(current.id)}` : "",
    {
      method: current ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(current ? {} : { "Idempotency-Key": key }),
      },
      body: JSON.stringify({
        ...input,
        ...(current ? { version: current.version } : {}),
      }),
    },
  );
  if (!expense(result) || (current && result.id !== current.id))
    return invalid();
  return result;
}
export async function deletePersonalExpense(
  current: PersonalExpense,
): Promise<void> {
  await request(
    `/${encodeURIComponent(current.id)}?version=${current.version}`,
    { method: "DELETE" },
  );
}
export function errorMessage(error: unknown) {
  return error instanceof PersonalExpenseApiError
    ? error.message
    : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}
