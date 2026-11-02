import { apiFetch } from "@/shared/api/apiFetch";
import { initializeCsrf } from "@/features/auth/api";

async function write(path: string, method: string, body: unknown) {
  await initializeCsrf();
  const response = await apiFetch(`/backend/recurring-expenses/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    throw new Error(
      data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string"
        ? data.message
        : "분류를 저장하지 못했습니다. 다시 시도해 주세요.",
    );
  }
}
export async function moveSubcategory(
  id: string,
  expectedCategoryId: string,
  categoryId: string,
  beforeId?: string,
) {
  await write(`subcategories/${encodeURIComponent(id)}/parent`, "PATCH", {
    expectedCategoryId,
    categoryId,
    beforeId: beforeId ?? null,
  });
}
export async function renameCategory(
  id: string,
  name: string,
  expectedName: string,
) {
  await write(`categories/${encodeURIComponent(id)}`, "PATCH", {
    name,
    expectedName,
  });
}
export async function updateSubcategory(
  id: string,
  name: string,
  expectedName: string,
  categoryId: string,
  expectedCategoryId: string,
) {
  await write(`subcategories/${encodeURIComponent(id)}`, "PATCH", {
    name,
    expectedName,
    categoryId,
    expectedCategoryId,
  });
}
export async function reorderClassifications(
  ids: string[],
  previousIds: string[],
  categoryId?: string,
) {
  const path = categoryId
    ? `categories/${encodeURIComponent(categoryId)}/subcategories/order`
    : "categories/order";
  await write(path, "PUT", { ids, previousIds });
}
