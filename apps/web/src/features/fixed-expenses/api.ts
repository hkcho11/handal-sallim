export interface FixedExpense {
  id: string;
  name: string;
  expectedAmount: number;
  intervalMonths: 1 | 2 | 3 | 12;
  firstDueDate: string;
  firstChargeId: string;
  firstChargeStatus: "PENDING" | "OVERDUE" | "COMPLETED";
}

export interface NewFixedExpense {
  name: string;
  expectedAmount: number;
  intervalMonths: FixedExpense["intervalMonths"];
  firstDueDate: string;
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
    [1, 2, 3, 12].includes(Number(value.intervalMonths)) &&
    isIsoDate(value.firstDueDate) &&
    isUuid(value.firstChargeId) &&
    ["PENDING", "OVERDUE", "COMPLETED"].includes(
      String(value.firstChargeStatus),
    )
  );
}

async function readResult(response: Response): Promise<unknown> {
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: "입력값을 확인해 주세요.",
      401: "로그인이 필요합니다.",
      403: "사용할 수 있는 공간이 없습니다.",
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
    response = await fetch("/backend/recurring-expenses", {
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

export async function createFixedExpense(
  input: NewFixedExpense,
  idempotencyKey: string,
): Promise<FixedExpense> {
  let response: Response;
  try {
    response = await fetch("/backend/recurring-expenses", {
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
