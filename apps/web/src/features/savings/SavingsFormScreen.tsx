"use client";

import Link from "@/shared/ui/AppLink";
import OwnerSelect from "@/shared/ui/OwnerSelect";
import { useOwnerOptions } from "@/shared/ui/useOwnerOptions";
import { useAppRouter as useRouter } from "@/shared/ui/useAppRouter";
import { useEffect, useRef, useState, type FormEvent } from "react";
import WonInput from "@/shared/ui/WonInput";
import {
  depositLabel,
  errorMessage,
  getSavings,
  saveSavings,
  type Savings,
} from "./api";
import styles from "./savings.module.css";

export default function SavingsFormScreen({ id }: { id?: string }) {
  const router = useRouter();
  const owners = useOwnerOptions("savings");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [current, setCurrent] = useState<Savings>();
  const [name, setName] = useState("");
  const [type, setType] = useState<Savings["type"]>("INSTALLMENT");
  const [depositAmount, setDepositAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [isLoading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const key = useRef<string | null>(null);
  const returnUrl = id ? `/savings/${id}` : "/savings";
  useEffect(() => {
    if (!id) return;
    let active = true;
    getSavings(id)
      .then((item) => {
        if (!active) return;
        setCurrent(item);
        setOwnerUserId(item.ownerUserId);
        setName(item.name);
        setType(item.type);
        setDepositAmount(String(item.depositAmount));
        setCurrentAmount(String(item.currentAmount));
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
      !/^[0-9]+$/.test(depositAmount) ||
      !Number.isSafeInteger(Number(depositAmount)) ||
      Number(depositAmount) < 1 ||
      !/^[0-9]+$/.test(currentAmount) ||
      !Number.isSafeInteger(Number(currentAmount)) ||
      Number(currentAmount) < 0
    ) {
      setError(
        "저축명과 금액을 확인해 주세요. 납입액은 1원 이상, 현재 금액은 0원 이상이어야 해요.",
      );
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
      const saved = await saveSavings(
        {
          name: name.trim(),
          ownerUserId: selectedOwner,
          type,
          depositAmount: Number(depositAmount),
          currentAmount: Number(currentAmount),
        },
        key.current,
        current,
      );
      router.push(`/savings/${saved.id}`);
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
          <span className={styles.back}>← 돌아가기</span>
        ) : (
          <Link className={styles.back} href={returnUrl}>
            {id ? "← 저축 상세" : "← 저축 목록"}
          </Link>
        )}
        <h1>{id ? "저축 수정" : "저축 등록"}</h1>
        <p className={styles.description}>
          새로 시작한 저축도, 이미 모으고 있던 저축도 기록해요.
        </p>
      </header>
      {isLoading || owners.isLoading ? (
        <p role="status">저축을 불러오는 중…</p>
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
                label="저축 소유자"
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
            <label className={styles.field}>
              저축 종류
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as Savings["type"]);
                  key.current = null;
                }}
              >
                <option value="INSTALLMENT">적금</option>
                <option value="DEPOSIT">예금</option>
              </select>
            </label>
            <label className={styles.field}>
              저축명
              <input
                required
                maxLength={120}
                placeholder="예: 여행 적금, 목돈 예금"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  key.current = null;
                }}
              />
            </label>
            <label className={styles.field}>
              {depositLabel(type)} (원)
              <WonInput
                required
                pattern="[0-9,]+"
                placeholder="0"
                value={depositAmount}
                onValueChange={(value) => {
                  setDepositAmount(value);
                  key.current = null;
                }}
              />
            </label>
            <label className={styles.field}>
              현재 금액 (원)
              <WonInput
                required
                pattern="[0-9,]+"
                placeholder="0"
                value={currentAmount}
                aria-describedby="current-amount-help"
                onValueChange={(value) => {
                  setCurrentAmount(value);
                  key.current = null;
                }}
              />
            </label>
            <p id="current-amount-help" className={styles.hint}>
              이미 보유한 예적금은 지금 모인 금액을 입력하세요. 새 저축은
              0원으로 시작할 수 있어요. 현재 금액은 직접 수정하며 납입액을
              자동으로 더하지 않아요.
            </p>
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
