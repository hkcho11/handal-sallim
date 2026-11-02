"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  addFixedExpenseCategory,
  addFixedExpenseSubcategory,
} from "../fixed-expenses/api";
import { errorMessage } from "../payment-methods/api";
import styles from "./settings.module.css";

export default function ClassificationCreateDialog({
  categories,
  onClose,
  onCreated,
  onBusy,
}: {
  categories: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (saved: { id: string; name: string; categoryId?: string }) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [kind, setKind] = useState<"category" | "subcategory">("category");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [nameError, setNameError] = useState("");
  const [parentError, setParentError] = useState("");
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const parentInput = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    nameInput.current?.focus();
  }, [kind]);
  function close() {
    if (busy.current) return;
    dialog.current?.close();
    onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    setFailure("");
    setNameError("");
    setParentError("");
    const invalidName = !name.trim() || name.trim().length > 80;
    if (invalidName) setNameError("이름은 1~80자로 입력해 주세요.");
    if (kind === "subcategory" && !parentId) {
      setParentError("상위 분류를 선택해 주세요.");
      parentInput.current?.focus();
      return;
    }
    if (invalidName) {
      nameInput.current?.focus();
      return;
    }
    busy.current = true;
    setSaving(true);
    onBusy(true);
    try {
      const saved =
        kind === "category"
          ? await addFixedExpenseCategory(name.trim())
          : await addFixedExpenseSubcategory(parentId, name.trim());
      dialog.current?.close();
      onCreated(saved);
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      busy.current = false;
      setSaving(false);
      onBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} ${styles.createDialog}`}
      aria-labelledby="create-classification-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form noValidate onSubmit={submit} className={styles.form}>
        <div className={styles.classificationHeading}>
          <h2 id="create-classification-title">분류 추가</h2>
          <button
            type="button"
            className={styles.closeDialog}
            aria-label="분류 추가 닫기"
            disabled={saving}
            onClick={close}
          >
            ×
          </button>
        </div>
        <div
          className={styles.creationTypes}
          role="group"
          aria-label="추가할 분류 종류"
        >
          {(["category", "subcategory"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              disabled={
                saving || (value === "subcategory" && categories.length === 0)
              }
              onClick={() => {
                setKind(value);
                setNameError("");
                setParentError("");
                setFailure("");
              }}
            >
              {value === "category" ? "상위 분류" : "세부 분류"}
            </button>
          ))}
        </div>
        {kind === "subcategory" && (
          <label className={styles.field}>
            상위 분류 선택
            <select
              ref={parentInput}
              aria-label="상위 분류 선택"
              value={parentId}
              disabled={saving}
              aria-invalid={!!parentError}
              aria-describedby={parentError ? "create-parent-error" : undefined}
              onChange={(event) => {
                setParentId(event.target.value);
                setParentError("");
                setFailure("");
              }}
            >
              <option value="">선택해 주세요</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {parentError && (
              <span
                id="create-parent-error"
                role="alert"
                className={styles.error}
              >
                {parentError}
              </span>
            )}
          </label>
        )}
        <label className={styles.field}>
          {kind === "category" ? "새 상위 분류 이름" : "새 세부 분류 이름"}
          <input
            ref={nameInput}
            value={name}
            maxLength={80}
            disabled={saving}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "create-name-error" : undefined}
            placeholder={kind === "category" ? "예: 반려동물" : "예: 동물병원"}
            onChange={(event) => {
              setName(event.target.value);
              setNameError("");
              setFailure("");
            }}
          />
          {nameError && (
            <span id="create-name-error" role="alert" className={styles.error}>
              {nameError}
            </span>
          )}
        </label>
        {failure && (
          <p className={styles.error} role="alert">
            {failure}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={saving}
            onClick={close}
          >
            취소
          </button>
          <button className={styles.primary} disabled={saving}>
            {saving ? "추가 중…" : "추가"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
