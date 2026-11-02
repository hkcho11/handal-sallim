"use client";

import Link from "@/shared/ui/AppLink";
import OwnerSelect from "@/shared/ui/OwnerSelect";
import { useOwnerOptions } from "@/shared/ui/useOwnerOptions";
import { useAppRouter as useRouter } from "@/shared/ui/useAppRouter";
import WonInput from "../../shared/ui/WonInput";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  errorMessage,
  getIncome,
  saveIncome,
  validMonth,
  type Income,
} from "./api";
import { currentMonth } from "./month";
import MonthNavigation from "./MonthNavigation";
import styles from "./income.module.css";

export default function IncomeFormScreen({
  id,
  initialMonth,
}: {
  id?: string;
  initialMonth?: string;
}) {
  const router = useRouter();
  const owners = useOwnerOptions("incomes");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [current, setCurrent] = useState<Income>();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(() => initialMonth ?? currentMonth());
  const [isLoading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [isSaving, setSaving] = useState(false);
  const busy = useRef(false);
  const key = useRef<string | null>(null);
  const returnUrl = `/income?month=${initialMonth ?? current?.month ?? month}`;

  useEffect(() => {
    if (!id) return;
    let active = true;
    getIncome(id)
      .then((item) => {
        if (!active) return;
        setCurrent(item);
        setOwnerUserId(item.ownerUserId);
        setName(item.name);
        setAmount(String(item.amount));
        setMonth(item.month);
        setLoadError("");
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
  }, [id, attempt]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || (id && !current)) return;
    if (
      !name.trim() ||
      name.trim().length > 120 ||
      !/^[0-9]+$/.test(amount) ||
      !Number.isSafeInteger(Number(amount)) ||
      Number(amount) < 1 ||
      !validMonth(month)
    ) {
      setError("수입명과 1원 이상의 정수 금액, 해당 월을 입력해 주세요.");
      return;
    }
    const selectedOwner = ownerUserId || owners.options?.currentUserId;
    if (
      !selectedOwner ||
      (!owners.options?.members.some((member) => member.id === selectedOwner) &&
        selectedOwner !== current?.ownerUserId)
    ) {
      setError("공간 멤버 중 소유자를 선택해 주세요.");
      return;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    key.current ??= crypto.randomUUID();
    try {
      const saved = await saveIncome(
        {
          name: name.trim(),
          amount: Number(amount),
          month,
          ownerUserId: selectedOwner,
        },
        key.current,
        current,
      );
      router.push(`/income?month=${saved.month}`);
    } catch (e) {
      setError(errorMessage(e));
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <main className={styles.screen}>
      <header className={styles.formHeader}>
        {isSaving ? (
          <span className={styles.back}>← 수입 목록</span>
        ) : (
          <Link className={styles.back} href={returnUrl}>
            ← 수입 목록
          </Link>
        )}
        <h1>{id ? "수입 수정" : "수입 등록"}</h1>
        <p className={styles.description}>
          수입명과 금액을 입력해 해당 월의 수입을 기록하세요.
        </p>
      </header>
      {isLoading || owners.isLoading ? (
        <p role="status">수입을 불러오는 중…</p>
      ) : loadError || owners.error ? (
        <div className={styles.card}>
          <p role="alert" className={styles.error}>
            {loadError || owners.error}
          </p>
          <button
            className={styles.secondary}
            onClick={() => {
              if (id) {
                setLoading(true);
                setAttempt((n) => n + 1);
              }
              owners.retry();
            }}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <form className={`${styles.form} ${styles.card}`} onSubmit={handleSave}>
          <fieldset disabled={isSaving}>
            {owners.options && (
              <OwnerSelect
                label="수입 소유자"
                className={styles.field}
                options={owners.options}
                value={ownerUserId}
                previousName={current?.ownerName}
                onChange={(value) => {
                  setOwnerUserId(value);
                  key.current = null;
                }}
              />
            )}
            <MonthNavigation
              label="해당 월"
              value={month}
              today={currentMonth()}
              disabled={isSaving}
              onChange={(value) => {
                setMonth(value);
                key.current = null;
              }}
            />
            <label className={styles.field}>
              수입명
              <input
                required
                maxLength={120}
                placeholder="예: 월급, 부수입"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  key.current = null;
                }}
              />
            </label>
            <label className={styles.field}>
              금액 (원)
              <WonInput
                required
                pattern="[0-9,]+"
                placeholder="0"
                value={amount}
                onValueChange={(value) => {
                  setAmount(value);
                  key.current = null;
                }}
              />
            </label>
          </fieldset>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "저장 중…" : "저장"}
            </button>
            {!isSaving && (
              <Link className={styles.secondary} href={returnUrl}>
                취소
              </Link>
            )}
          </div>
        </form>
      )}
    </main>
  );
}
