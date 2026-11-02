import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import FixedExpensesScreen from "./FixedExpensesScreen";
import FixedExpensesListScreen from "./FixedExpensesListScreen";
import FixedExpenseDetailScreen from "./FixedExpenseDetailScreen";
import { FixedExpenseListFiltersProvider } from "./FixedExpenseListFilters";
vi.mock("./chargeApi", () => ({ loadCharges: vi.fn().mockResolvedValue([]) }));
import {
  updateFixedExpense,
  createFixedExpense,
  getFixedExpenseFormOptions,
  listFixedExpenses,
  deleteFixedExpense,
} from "./api";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    updateFixedExpense: vi.fn(),
    createFixedExpense: vi.fn(),
    getFixedExpenseFormOptions: vi.fn(),
    listFixedExpenses: vi.fn(),
    deleteFixedExpense: vi.fn(),
  };
});

const categoryId = "11111111-1111-4111-8111-111111111111";
const subcategoryId = "22222222-2222-4222-8222-222222222222";
const classification = {
  categories: [{ id: categoryId, name: "통신" }],
  subcategories: [{ id: subcategoryId, categoryId, name: "인터넷" }],
};
async function selectClassification() {
  await screen.findByRole("option", { name: "통신" });
  fireEvent.change(screen.getByLabelText("대분류"), {
    target: { value: categoryId },
  });
  fireEvent.change(screen.getByLabelText("중분류"), {
    target: { value: subcategoryId },
  });
}

beforeEach(() => {
  vi.mocked(updateFixedExpense).mockReset();
  vi.mocked(createFixedExpense).mockReset();
  vi.mocked(getFixedExpenseFormOptions).mockReset();
  vi.mocked(listFixedExpenses).mockReset();
  vi.mocked(deleteFixedExpense).mockReset();
  vi.mocked(getFixedExpenseFormOptions).mockResolvedValue({
    ...classification,
    payers: [],
    paymentMethods: [],
  });
});

afterEach(cleanup);

const navigate = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigate, replace: navigate }),
  useSearchParams: () => new URLSearchParams(),
}));

const expense = {
  id: "3c6b40a1-3fea-454b-93ac-a7a9917cff10",
  name: "인터넷",
  categoryId,
  categoryName: "통신",
  subcategoryId,
  subcategoryName: "인터넷",
  memo: null,
  expectedAmount: 35000,
  intervalMonths: null,
  recurringDayOfMonth: null,
  firstDueDate: null,
  firstChargeId: null,
  firstChargeStatus: null,
  payer: null,
  paymentMethodId: null,
  paymentMethodName: null,
} as const;

beforeEach(() => {
  navigate.mockReset();
  vi.mocked(updateFixedExpense).mockReset();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

test("상세 삭제는 확인 후 요청하며 실패하면 팝업에서 재시도한다", async () => {
  vi.mocked(listFixedExpenses).mockResolvedValue([expense]);
  vi.mocked(deleteFixedExpense)
    .mockRejectedValueOnce(new Error("internal details"))
    .mockResolvedValueOnce(undefined);
  render(<FixedExpenseDetailScreen id={expense.id} />);
  fireEvent.click(await screen.findByRole("button", { name: "고정비 삭제" }));
  await screen.findByRole("dialog", { name: "고정비를 삭제할까요?" });
  expect(deleteFixedExpense).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(deleteFixedExpense).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "고정비 삭제" }));
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  await screen.findByText("삭제하지 못했습니다. 다시 시도해 주세요.");
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.queryByText("internal details")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/fixed-costs"));
  expect(deleteFixedExpense).toHaveBeenCalledTimes(2);
});

test("등록 후 상세로 이동하며 입력 화면에 기존 목록을 표시하지 않는다", async () => {
  vi.mocked(createFixedExpense).mockResolvedValue(expense);
  render(<FixedExpensesScreen />);
  await selectClassification();
  fireEvent.change(screen.getByLabelText("금액 (원)"), {
    target: { value: "35000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "고정비 저장" }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith(`/fixed-costs/${expense.id}`),
  );
  expect(screen.queryByRole("heading", { name: "등록한 고정비" })).toBeNull();
  expect(createFixedExpense).toHaveBeenCalledWith(
    expect.objectContaining({
      memo: null,
      categoryId,
      subcategoryId,
      expectedAmount: 35000,
      intervalMonths: null,
      recurringDayOfMonth: null,
      firstDueDate: null,
      payer: null,
      paymentMethodId: null,
    }),
    expect.any(String),
  );
});

test("목록에는 입력 폼 없이 추가와 상세 링크를 표시한다", async () => {
  vi.mocked(listFixedExpenses).mockResolvedValue([
    {
      ...expense,
      intervalMonths: 1,
      recurringDayOfMonth: 15,
      firstDueDate: "2026-05-15",
      firstChargeDueDate: "2026-10-15",
    },
  ]);
  render(<FixedExpensesListScreen />, {
    wrapper: FixedExpenseListFiltersProvider,
  });
  const detail = await screen.findByRole("link", { name: /인터넷/ });
  expect(detail.getAttribute("href")).toBe(`/fixed-costs/${expense.id}`);
  expect(
    screen.getByRole("link", { name: "고정비 추가" }).getAttribute("href"),
  ).toBe("/entries/new");
  expect(screen.getByRole("searchbox", { name: "중분류 검색" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /저장/ })).toBeNull();
  expect(screen.getByText("매월 · 결제일 15일")).toBeTruthy();
  expect(screen.queryByText(/2026-05-15|2026-10-15/)).toBeNull();
});

test("검색을 시작하면 전체로 바꾸고 카테고리를 고르면 검색을 해제한다", async () => {
  vi.mocked(listFixedExpenses).mockResolvedValue([
    { ...expense, memo: "목록에 표시하지 않는 메모" },
    {
      ...expense,
      id: "utility-expense",
      categoryName: "공과금",
      subcategoryName: "전기",
      name: "전기요금 메모",
    },
  ]);
  render(<FixedExpensesListScreen />, {
    wrapper: FixedExpenseListFiltersProvider,
  });
  await screen.findByRole("link", { name: /인터넷/ });
  expect(screen.queryByText("목록에 표시하지 않는 메모")).toBeNull();
  const search = screen.getByRole("searchbox", { name: "중분류 검색" });
  fireEvent.click(screen.getByRole("button", { name: "통신" }));
  fireEvent.change(search, { target: { value: " 전 기 " } });
  expect(screen.queryByRole("link", { name: /인터넷/ })).toBeNull();
  expect(screen.getByRole("link", { name: /전기/ })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "전체" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "통신" }));
  expect(screen.getByRole("link", { name: /인터넷/ })).toBeTruthy();
  expect((search as HTMLInputElement).value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "검색·필터 초기화" }));
  expect(screen.getByRole("link", { name: /인터넷/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: /전기/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "공과금" }));
  expect(screen.queryByRole("link", { name: /인터넷/ })).toBeNull();
  expect(screen.getByRole("link", { name: /전기/ })).toBeTruthy();
});

test("상세에서 목록으로 돌아오면 전체 검색 상태를 유지한다", async () => {
  vi.mocked(listFixedExpenses).mockResolvedValue([
    expense,
    {
      ...expense,
      id: "other-expense",
      name: "전기",
      categoryName: "공과금",
      subcategoryName: "전기",
    },
  ]);
  const { rerender } = render(<FixedExpensesListScreen />, {
    wrapper: FixedExpenseListFiltersProvider,
  });
  await screen.findByRole("link", { name: /인터넷/ });
  fireEvent.click(screen.getByRole("button", { name: "통신" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "중분류 검색" }), {
    target: { value: "인 터 넷" },
  });

  rerender(<FixedExpenseDetailScreen id={expense.id} />);
  await screen.findByRole("heading", { name: "인터넷" });
  rerender(<FixedExpensesListScreen />);
  await screen.findByRole("link", { name: /인터넷/ });
  expect(
    (screen.getByRole("searchbox", { name: "중분류 검색" }) as HTMLInputElement)
      .value,
  ).toBe("인 터 넷");
  expect(
    screen.getByRole("button", { name: "전체" }).getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.queryByRole("link", { name: /전기/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "검색·필터 초기화" }));
  expect(screen.getByRole("link", { name: /전기/ })).toBeTruthy();
});

test("상세에서 정보를 수정하고 결과를 다시 조회한다", async () => {
  vi.mocked(listFixedExpenses).mockResolvedValue([expense]);
  vi.mocked(updateFixedExpense).mockResolvedValue({
    ...expense,
    intervalMonths: 1,
    recurringDayOfMonth: 15,
    firstDueDate: "2026-11-15",
    firstChargeId: "charge-1",
    firstChargeStatus: "PENDING",
  });
  render(<FixedExpenseDetailScreen id={expense.id} />);
  fireEvent.click(await screen.findByRole("button", { name: "정보 수정" }));
  expect(
    (screen.getByLabelText("메모 (선택)") as HTMLInputElement).disabled,
  ).toBe(false);
  fireEvent.change(screen.getByLabelText("반복주기"), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText("첫 결제일"), {
    target: { value: "2026-11-15" },
  });
  await screen.findByRole("option", { name: "인터넷" });
  fireEvent.click(screen.getByRole("button", { name: "정보 저장" }));
  await screen.findByText("고정비 정보를 수정했습니다.");
  expect(screen.getByText("2026-11-15")).toBeTruthy();
  expect(updateFixedExpense).toHaveBeenCalledWith(
    expense.id,
    expect.objectContaining({ recurringDayOfMonth: 15 }),
  );
  expect(screen.queryByRole("textbox")).toBeNull();
});

test("잘못된 입력은 필드 안내와 첫 오류 초점을 제공한다", async () => {
  render(<FixedExpensesScreen />);
  fireEvent.click(screen.getByRole("button", { name: "고정비 저장" }));
  expect(screen.getByText("대분류를 선택해 주세요.")).toBeTruthy();
  expect(
    screen.getByText("1원 이상의 금액을 숫자로 입력해 주세요."),
  ).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByLabelText("대분류"));
  expect(screen.getByLabelText("대분류").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(createFixedExpense).not.toHaveBeenCalled();
  await selectClassification();
  expect(screen.queryByText("대분류를 선택해 주세요.")).toBeNull();
  await screen.findByLabelText("결제수단");
});

test("선택지 요청 오류는 재시도를 제공하고 혼자 관리에서는 결제자를 숨긴다", async () => {
  vi.mocked(getFixedExpenseFormOptions).mockRejectedValue(
    new Error("raw internal error"),
  );
  render(<FixedExpensesScreen />);
  await screen.findByText("요청을 처리하지 못했습니다. 다시 시도해 주세요.");
  expect(screen.queryByLabelText("결제자")).toBeNull();
  expect(
    (screen.getByRole("button", { name: "고정비 저장" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(screen.queryByText("raw internal error")).toBeNull();
});

test("함께 관리에서는 결제자와 등록된 결제수단을 선택한다", async () => {
  const methodId = "4bdcc856-5663-4052-9a82-f38886058c57";
  vi.mocked(getFixedExpenseFormOptions).mockResolvedValue({
    ...classification,
    payers: [
      { value: "ME", label: "나" },
      { value: "PARTNER", label: "상대" },
    ],
    paymentMethods: [{ id: methodId, name: "생활비 카드", type: "CARD" }],
  });
  vi.mocked(createFixedExpense).mockResolvedValue({
    ...expense,
    payer: "PARTNER",
    paymentMethodId: methodId,
    paymentMethodName: "생활비 카드",
  });
  render(<FixedExpensesScreen />);
  await screen.findByLabelText("결제자");
  await selectClassification();
  fireEvent.change(screen.getByLabelText("금액 (원)"), {
    target: { value: "35000" },
  });
  fireEvent.change(screen.getByLabelText("결제자"), {
    target: { value: "PARTNER" },
  });
  fireEvent.change(screen.getByLabelText("결제수단"), {
    target: { value: methodId },
  });
  fireEvent.click(screen.getByRole("button", { name: "고정비 저장" }));
  await waitFor(() =>
    expect(createFixedExpense).toHaveBeenCalledWith(
      expect.objectContaining({ payer: "PARTNER", paymentMethodId: methodId }),
      expect.any(String),
    ),
  );
});

test("이미 설정한 모든 정보를 상세에서 수정할 수 있다", async () => {
  const firstMethod = "4bdcc856-5663-4052-9a82-f38886058c57";
  const secondMethod = "62eed6f5-fdf8-47cd-bffe-7c53f94ed1d8";
  const original = {
    ...expense,
    intervalMonths: 1 as const,
    recurringDayOfMonth: 15,
    firstDueDate: "2026-11-15",
    payer: "ME" as const,
    paymentMethodId: firstMethod,
    paymentMethodName: "생활비 카드",
    firstChargeId: "charge-1",
    firstChargeStatus: "PENDING" as const,
  };
  const updated = {
    ...original,
    name: "통신비",
    expectedAmount: 42000,
    intervalMonths: 3 as const,
    recurringDayOfMonth: 25,
    firstDueDate: "2026-11-25",
    payer: "PARTNER" as const,
    paymentMethodId: secondMethod,
    paymentMethodName: "생활비 계좌",
  };
  vi.mocked(listFixedExpenses).mockResolvedValue([original]);
  vi.mocked(getFixedExpenseFormOptions).mockResolvedValue({
    ...classification,
    payers: [
      { value: "ME", label: "나" },
      { value: "PARTNER", label: "상대" },
    ],
    paymentMethods: [
      { id: firstMethod, name: "생활비 카드", type: "CARD" },
      { id: secondMethod, name: "생활비 계좌", type: "ACCOUNT" },
    ],
  });
  vi.mocked(updateFixedExpense).mockResolvedValue(updated);
  render(<FixedExpenseDetailScreen id={expense.id} />);
  fireEvent.click(await screen.findByRole("button", { name: "정보 수정" }));
  await screen.findByLabelText("결제자");
  for (const label of [
    "메모 (선택)",
    "금액 (원)",
    "반복주기",
    "반복 결제일",
    "첫 결제일",
    "결제자",
    "결제수단",
  ])
    expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(
      false,
    );
  for (const [label, value] of [
    ["메모 (선택)", "통신비"],
    ["금액 (원)", "42000"],
    ["반복주기", "3"],
    ["반복 결제일", "25"],
    ["첫 결제일", "2026-11-25"],
    ["결제자", "PARTNER"],
    ["결제수단", secondMethod],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await screen.findByRole("option", { name: "인터넷" });
  fireEvent.click(screen.getByRole("button", { name: "정보 저장" }));
  await screen.findByText("고정비 정보를 수정했습니다.");
  expect(updateFixedExpense).toHaveBeenCalledWith(expense.id, {
    memo: "통신비",
    categoryId,
    subcategoryId,
    expectedAmount: 42000,
    intervalMonths: 3,
    recurringDayOfMonth: 25,
    firstDueDate: "2026-11-25",
    payer: "PARTNER",
    paymentMethodId: secondMethod,
  });
});
