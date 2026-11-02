"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  authAction,
  currentSession,
  parseSession,
  initializeCsrf,
  type AccountSession,
} from "./api";
import styles from "./auth.module.css";

export default function AuthBoundary({ children }: { children: ReactNode }) {
  const path = usePathname();
  const isPublic = path.startsWith("/auth/");
  const [account, setAccount] = useState<AccountSession | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [spaceName, setSpaceName] = useState("내 살림");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    if (isPublic) return;
    try {
      const session = await currentSession();
      setError("");
      if (!session) {
        window.location.replace(
          `/auth/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        );
        return;
      }
      setAccount(session);
      // Also initializes the CSRF cookie for existing sessions after browser restart.
      await initializeCsrf();
      setChecking(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "계정 확인에 실패했습니다.",
      );
    }
  }, [isPublic]);
  useEffect(() => {
    // load updates state only after the asynchronous server session lookup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    const expired = () => {
      setAccount(null);
      setChecking(true);
      void load();
    };
    window.addEventListener("auth-expired", expired);
    return () => window.removeEventListener("auth-expired", expired);
  }, [load]);
  if (isPublic) return children;
  if (checking || !account)
    return (
      <main className={styles.screen}>
        <h1>한달살림</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => void load()}>다시 시도</button>
          </>
        ) : (
          <p role="status">계정을 확인하고 있어요.</p>
        )}
      </main>
    );
  if (!account.hasSpace && !path.startsWith("/settings/sharing"))
    return (
      <main className={styles.screen}>
        <p className={styles.eyebrow}>한달살림</p>
        <h1>첫 공간을 만들어 주세요</h1>
        <p>{account.name}님의 수입과 생활비를 관리할 개인 공간이에요.</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError("");
            try {
              setAccount(
                parseSession(await authAction("space", { name: spaceName })),
              );
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "공간을 만들지 못했습니다.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            공간 이름
            <input
              required
              maxLength={100}
              value={spaceName}
              onChange={(event) => setSpaceName(event.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button disabled={saving}>
            {saving ? "만드는 중…" : "내 살림 시작하기"}
          </button>
        </form>
        <p>
          <Link href="/settings/sharing">회원코드로 다른 사람과 함께 쓰기</Link>
        </p>
        <button
          className={styles.secondary}
          onClick={async () => {
            try {
              await authAction("logout");
              window.location.replace("/auth/login");
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "로그아웃하지 못했습니다.",
              );
            }
          }}
        >
          다른 계정으로 로그인
        </button>
      </main>
    );
  return <div key={account.userId}>{children}</div>;
}
