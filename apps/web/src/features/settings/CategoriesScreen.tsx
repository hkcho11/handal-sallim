"use client";
import { focusWhenReady } from "@/shared/loadingState";
import Link from "@/shared/ui/AppLink";
import { useEffect, useRef, useState } from "react";
import { getFixedExpenseFormOptions } from "@/features/fixed-expenses/api";
import { errorMessage } from "@/features/payment-methods/api";
import styles from "./settings.module.css";
import ClassificationEditor from "./ClassificationEditor";
import ClassificationCreateDialog from "./ClassificationCreateDialog";
export default function CategoriesScreen() {
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [subcategories, setSubcategories] = useState<
    { id: string; categoryId: string; name: string }[]
  >([]);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const createdId = useRef<string | null>(null);
  useEffect(() => {
    if (creating || isSaving || !createdId.current) return;
    const added = document.querySelector<HTMLButtonElement>(
      `[data-handle-id="${CSS.escape(createdId.current)}"]`,
    );
    if (added) {
      added.scrollIntoView({ block: "center" });
      added.focus({ preventScroll: true });
      createdId.current = null;
    }
  }, [creating, isSaving, items, subcategories]);
  useEffect(() => {
    let active = true;
    getFixedExpenseFormOptions()
      .then((options) => {
        if (active) {
          setItems(options.categories ?? []);
          setSubcategories(options.subcategories ?? []);
          setLoadError("");
        }
      })
      .catch((e) => {
        if (active) setLoadError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  function closeCreate() {
    setCreating(false);
    requestAnimationFrame(() => addButton.current?.focus());
  }
  return (
    <main className={styles.screen}>
      <Link href="/settings" className={styles.back}>
        ‹ 설정
      </Link>
      <header className={`${styles.header} ${styles.categoryHeader}`}>
        <h1>분류 설정</h1>
        <button
          ref={addButton}
          type="button"
          className={styles.primary}
          disabled={isLoading || !!loadError || isSaving}
          onClick={() => {
            setMessage("");
            setCreating(true);
          }}
        >
          + 추가
        </button>
      </header>
      <p>
        고정비 분류와 그 안의 세부 분류를 관리해요. 함께 관리하는 공간에서는
        멤버에게도 공유돼요.
      </p>
      <p role="status" className={styles.creationNotice}>
        {message}
      </p>
      {isLoading ? (
        <p role="status">분류를 불러오는 중…</p>
      ) : loadError ? (
        <div className={styles.card}>
          <p role="alert" className={styles.error}>
            {loadError}
          </p>
          <button
            className={styles.secondary}
            onClick={() => {
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <div className={styles.classificationSearch}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              ref={searchInput}
              type="search"
              aria-label="분류 검색"
              placeholder="상위·세부 분류 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="분류 검색 지우기"
                onClick={() => {
                  setQuery("");
                  focusWhenReady(searchInput.current);
                }}
              >
                ×
              </button>
            )}
          </div>
          <h2>사용 중인 상위 분류 {items.length}개</h2>
          <ClassificationEditor
            items={items}
            subcategories={subcategories}
            query={query}
            onSearchFocus={() => focusWhenReady(searchInput.current)}
            disabled={isSaving}
            onBusy={setSaving}
            onChange={(categories, subs) => {
              setItems(categories);
              setSubcategories(subs);
            }}
          />
        </>
      )}
      {creating && (
        <ClassificationCreateDialog
          categories={items}
          onBusy={setSaving}
          onClose={closeCreate}
          onCreated={(saved) => {
            setQuery("");
            if (saved.categoryId) {
              const sub = { ...saved, categoryId: saved.categoryId };
              setSubcategories((current) =>
                current.some((item) => item.id === sub.id)
                  ? current
                  : [...current, sub],
              );
              setMessage(`${saved.name} 세부 분류를 사용할 수 있어요.`);
            } else {
              setItems((current) =>
                current.some((item) => item.id === saved.id)
                  ? current
                  : [...current, saved],
              );
              setMessage(`${saved.name} 분류를 사용할 수 있어요.`);
            }
            createdId.current = saved.id;
            setCreating(false);
          }}
        />
      )}
    </main>
  );
}
