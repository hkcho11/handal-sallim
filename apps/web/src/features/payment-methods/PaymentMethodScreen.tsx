"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  listFixedExpenses,
  type FixedExpense,
} from "@/features/fixed-expenses/api";
import {
  archivePaymentMethod,
  errorMessage,
  listMembers,
  listPaymentMethods,
  savePaymentMethod,
  typeLabels,
  type Member,
  type PaymentMethod,
  type PaymentMethodInput,
} from "./api";
import styles from "@/features/settings/settings.module.css";

export default function PaymentMethodScreen({
  id,
  edit = false,
}: {
  id?: string;
  edit?: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<PaymentMethod>();
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [input, setInput] = useState<PaymentMethodInput>({
    name: "",
    type: "CARD",
    holderUserId: null,
    color: null,
  });
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const key = useRef<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const archiveRef = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const isForm = !id || edit;
  useEffect(() => {
    let active = true;
    Promise.all([
      listPaymentMethods(),
      listMembers(),
      id && !edit ? listFixedExpenses() : Promise.resolve([]),
    ])
      .then(([methods, people, fixed]) => {
        if (!active) return;
        const item = methods.find((method) => method.id === id);
        if (id && !item) throw new Error("결제수단을 찾을 수 없습니다.");
        if (edit && item?.status === "ARCHIVED")
          throw new Error("보관한 결제수단은 수정할 수 없습니다.");
        setCurrent(item);
        setMembers(people);
        setExpenses(fixed);
        setLoadError("");
        if (item)
          setInput({
            name: item.name,
            type: item.type,
            holderUserId: item.holderUserId,
            color: item.color,
          });
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
  }, [id, edit, attempt]);
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    if (!input.name.trim() || input.name.trim().length > 100) {
      setNameError("이름은 1~100자로 입력해 주세요.");
      nameRef.current?.focus();
      return;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    key.current ??= crypto.randomUUID();
    try {
      const saved = await savePaymentMethod(
        { ...input, name: input.name.trim() },
        key.current,
        current,
      );
      router.push(`/payment-methods/${saved.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function handleArchive() {
    if (!current || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await archivePaymentMethod(current);
      setCurrent({
        ...current,
        status: "ARCHIVED",
        version: current.version + 1,
      });
      dialogRef.current?.close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const linked = expenses.filter((item) => item.paymentMethodId === id);
  return (
    <main className={styles.screen}>
      <Link
        href={edit && id ? `/payment-methods/${id}` : "/payment-methods"}
        className={styles.back}
      >
        ‹ {edit ? "결제수단 상세" : "결제수단 목록"}
      </Link>
      <header className={styles.header}>
        <h1>
          {isForm
            ? edit
              ? "결제수단 수정"
              : "결제수단 추가"
            : "결제수단 상세"}
        </h1>
      </header>
      {isLoading ? (
        <p role="status">결제수단을 불러오는 중…</p>
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
      ) : isForm ? (
        <form
          className={`${styles.card} ${styles.form}`}
          onSubmit={handleSubmit}
          noValidate
        >
          <p>
            이름과 종류는 필수예요. 카드번호나 계좌번호 대신 알아보기 쉬운
            별명을 입력해 주세요.
          </p>
          <label className={styles.field}>
            이름
            <input
              ref={nameRef}
              value={input.name}
              maxLength={100}
              autoComplete="off"
              placeholder="예: 생활비 카드"
              disabled={isSaving}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "name-error" : undefined}
              onChange={(event) => {
                setInput({ ...input, name: event.target.value });
                setNameError("");
                key.current = null;
              }}
            />
            {nameError && (
              <span id="name-error" className={styles.error}>
                {nameError}
              </span>
            )}
          </label>
          <label className={styles.field}>
            종류
            <select
              value={input.type}
              data-align="center"
              disabled={isSaving}
              onChange={(event) => {
                setInput({
                  ...input,
                  type: event.target.value as PaymentMethodInput["type"],
                });
                key.current = null;
              }}
            >
              <option value="CARD">카드</option>
              <option value="ACCOUNT">계좌</option>
              <option value="CASH">현금</option>
            </select>
          </label>
          <label className={styles.field}>
            명의자 / 담당자 (선택)
            <select
              value={input.holderUserId ?? ""}
              disabled={isSaving}
              onChange={(event) => {
                setInput({
                  ...input,
                  holderUserId: event.target.value || null,
                });
                key.current = null;
              }}
            >
              <option value="">미지정</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.field}>
            <span id="color-label">표시 색상 (선택)</span>
            <div
              className={styles.colors}
              role="group"
              aria-labelledby="color-label"
            >
              {[
                null,
                "#315beb",
                "#22865b",
                "#9356ce",
                "#d16c27",
                "#c43d48",
              ].map((color, index) => (
                <button
                  key={color ?? "none"}
                  type="button"
                  disabled={isSaving}
                  aria-label={
                    ["기본 색상", "파랑", "초록", "보라", "주황", "빨강"][index]
                  }
                  aria-pressed={input.color === color}
                  style={{ background: color ?? "#e9ecf2" }}
                  onClick={() => {
                    setInput({ ...input, color });
                    key.current = null;
                  }}
                />
              ))}
            </div>
          </div>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button className={styles.primary} disabled={isSaving}>
              {isSaving ? "저장 중…" : "저장"}
            </button>
            {!isSaving && (
              <Link
                className={styles.secondary}
                href={id ? `/payment-methods/${id}` : "/payment-methods"}
              >
                취소
              </Link>
            )}
          </div>
        </form>
      ) : (
        current && (
          <>
            <section className={styles.card}>
              <span className={styles.badge}>
                {current.status === "ACTIVE" ? "사용 중" : "보관됨"}
              </span>
              <h2>
                <span
                  className={styles.swatch}
                  style={{ background: current.color ?? "#687182" }}
                />
                {current.name}
              </h2>
              <dl className={styles.details}>
                <div>
                  <dt>종류</dt>
                  <dd>{typeLabels[current.type]}</dd>
                </div>
                <div>
                  <dt>명의자 / 담당자</dt>
                  <dd>
                    {members.find(
                      (member) => member.id === current.holderUserId,
                    )?.name ?? "미지정"}
                  </dd>
                </div>
              </dl>
              {current.status === "ACTIVE" ? (
                <div className={styles.actions}>
                  <Link
                    className={styles.primary}
                    href={`/payment-methods/${id}/edit`}
                  >
                    정보 수정
                  </Link>
                  <button
                    ref={archiveRef}
                    className={styles.secondary}
                    onClick={() => {
                      setError("");
                      dialogRef.current?.showModal();
                    }}
                  >
                    보관
                  </button>
                </div>
              ) : (
                <p>과거 결제 기록은 유지되며 새 내역에서는 선택할 수 없어요.</p>
              )}
            </section>
            {current.status === "ACTIVE" && (
              <section>
                <h2>연결된 고정비 {linked.length}개</h2>
                {linked.length === 0 ? (
                  <div className={styles.card}>
                    <p>
                      연결된 고정비가 없어요. 고정비의 정보 수정에서 이
                      결제수단을 선택할 수 있어요.
                    </p>
                  </div>
                ) : (
                  linked.map((item) => (
                    <Link
                      className={styles.row}
                      key={item.id}
                      href={`/fixed-costs/${item.id}`}
                    >
                      <span>
                        <strong>{item.name}</strong>
                        <small>첫 결제일 {item.firstDueDate ?? "미정"}</small>
                      </span>
                      <strong>
                        {item.expectedAmount.toLocaleString("ko-KR")}원
                      </strong>
                    </Link>
                  ))
                )}
              </section>
            )}
            <dialog
              ref={dialogRef}
              className={styles.dialog}
              aria-labelledby="archive-title"
              onCancel={(event) => {
                if (isSaving) event.preventDefault();
              }}
              onClose={() => archiveRef.current?.focus()}
            >
              <h2 id="archive-title">결제수단을 보관할까요?</h2>
              <strong>{current.name}</strong>
              <p>
                과거 완료·지출 기록은 유지해요. 연결된 고정비와 미완료 예정
                내역은 결제수단이 미지정으로 바뀌며, 새 내역에서는 이 결제수단을
                선택할 수 없어요.
              </p>
              {error && (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              )}
              <div className={styles.actions}>
                <button
                  autoFocus
                  className={styles.secondary}
                  disabled={isSaving}
                  onClick={() => dialogRef.current?.close()}
                >
                  취소
                </button>
                <button
                  className={styles.primary}
                  disabled={isSaving}
                  onClick={handleArchive}
                >
                  {isSaving ? "보관 중…" : "보관"}
                </button>
              </div>
            </dialog>
          </>
        )
      )}
    </main>
  );
}
