"use client";
import { replaceDocument } from "@/shared/loadingState";

import Link from "@/shared/ui/AppLink";
import { useEffect, useRef, useState } from "react";
import { authAction, currentSession, safeReturn } from "./api";
import {
  parseCodeRequest,
  parseCodeGrant,
  pendingEmailCode,
  saveEmailCode,
} from "./emailCode";
import styles from "./auth.module.css";

type Mode =
  "login" | "register" | "forgot" | "resend" | "verify" | "reset" | "account";
const titles: Record<Mode, string> = {
  login: "다시 만나 반가워요",
  register: "한달살림 시작하기",
  forgot: "비밀번호 찾기",
  resend: "가입 인증번호 받기",
  verify: "가입 이메일 확인",
  reset: "비밀번호 재설정",
  account: "내 계정",
};

export default function AuthScreen({ mode }: { mode: Mode }) {
  const reset = mode === "forgot" || mode === "reset";
  const flow = mode !== "login" && mode !== "account";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [requestId, setRequestId] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [legacyLink, setLegacyLink] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [resumeSignup, setResumeSignup] = useState(false);
  const [resumeReset, setResumeReset] = useState(false);
  const [ready, setReady] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    // Restore browser-only drafts after hydration and ignore an abandoned page.
    queueMicrotask(() => {
      if (!active) return;
      setReady(true);
      if (mode === "verify" || mode === "reset") {
        const value =
          new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
        window.history.replaceState(null, "", window.location.pathname);
        if (value) {
          setToken(value);
          setLegacyLink(true);
          return;
        }
      }
      if (flow) {
        const pending = pendingEmailCode(reset);
        if (pending) {
          setEmail(pending.email);
          setRequestId(pending.requestId);
          if (pending.phase === "password")
            setMessage("화면이 새로 열렸습니다. 인증번호를 다시 받아 주세요.");
        }
      }
      if (mode === "login") {
        setResumeSignup(Boolean(pendingEmailCode(false)));
        setResumeReset(Boolean(pendingEmailCode(true)));
      }
      if (mode === "account") {
        void currentSession()
          .then((session) => {
            if (!active) return;
            if (session) setName(session.name);
            else replaceDocument("/auth/login");
          })
          .catch(() => {
            if (active) setError("계정을 불러오지 못했습니다.");
          });
      }
    });
    return () => {
      active = false;
    };
  }, [mode, flow, reset]);

  const enteringCode = flow && Boolean(requestId) && !token && !complete;
  const settingPassword = flow && Boolean(token) && !complete;
  useEffect(() => {
    if (enteringCode) codeInput.current?.focus();
    else if (settingPassword) passwordInput.current?.focus();
  }, [enteringCode, settingPassword]);
  const enteringEmail =
    !complete && (mode === "login" || (flow && !requestId && !token));

  async function requestCode(reissue = false) {
    const action = reset
      ? "forgot"
      : reissue || mode !== "register"
        ? "resend"
        : "register";
    const body: Record<string, string> =
      action === "register" ? { email, name } : { email };
    const id = parseCodeRequest(await authAction(action, body));
    setRequestId(id);
    setToken("");
    setCode("");
    saveEmailCode(reset, { requestId: id, email, phase: "code" });
    setMessage(
      "요청하신 주소가 사용 가능하면 인증번호를 보냈습니다. 메일함을 확인한 뒤 이 화면에 입력해 주세요.",
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (settingPassword && password !== confirmation) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      if (enteringCode) {
        const grant = parseCodeGrant(
          await authAction("verify-code", { requestId, code, reset }),
        );
        setToken(grant);
        setCode("");
        saveEmailCode(reset, { requestId, email, phase: "password" });
        setMessage("이메일이 확인되었습니다. 사용할 비밀번호를 설정해 주세요.");
      } else if (settingPassword) {
        await authAction(reset ? "reset" : "verify", { token, password });
        setPassword("");
        setConfirmation("");
        setToken("");
        setComplete(true);
        saveEmailCode(reset, null);
        setMessage(
          reset
            ? "비밀번호를 변경했습니다. 다시 로그인해 주세요."
            : "가입이 완료되었습니다. 로그인해 주세요.",
        );
      } else if (mode === "login") {
        await authAction("login", { email, password });
        setPassword("");
        replaceDocument(
          safeReturn(
            new URLSearchParams(window.location.search).get("returnTo"),
          ),
        );
      } else if (mode === "account") {
        await authAction("logout");
        replaceDocument("/auth/login");
      } else await requestCode();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await requestCode(true);
      setPassword("");
      setConfirmation("");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  function changeEmail() {
    saveEmailCode(reset, null);
    setRequestId("");
    setToken("");
    setCode("");
    setPassword("");
    setConfirmation("");
    setMessage("");
    setError("");
  }
  const label = enteringCode
    ? "인증번호 확인"
    : settingPassword
      ? reset
        ? "비밀번호 변경"
        : "비밀번호 설정하고 가입 완료"
      : mode === "login"
        ? "로그인"
        : mode === "account"
          ? "로그아웃"
          : reset
            ? "재설정 인증번호 받기"
            : "가입 인증번호 받기";

  return (
    <main className={styles.screen}>
      <Link className={styles.eyebrow} href="/">
        한달살림
      </Link>
      <h1>
        {enteringCode
          ? "이메일 인증번호 입력"
          : settingPassword
            ? reset
              ? "새 비밀번호 설정"
              : "비밀번호 설정하기"
            : titles[mode]}
      </h1>
      {flow && enteringEmail && (
        <p>
          이메일로 받은 인증번호를 이 화면에 입력한 뒤 비밀번호를 설정해 주세요.
        </p>
      )}
      {enteringCode && (
        <p>
          {email} 메일함에서 숫자 6자리 인증번호를 확인해 이 화면에 입력해
          주세요. 유효시간은 10분이며 5회 틀리면 새 번호를 받아야 해요.
        </p>
      )}
      {mode === "account" && (
        <p>
          {name ? `${name}님으로 로그인 중이에요.` : "계정을 확인하고 있어요."}
        </p>
      )}
      <form onSubmit={submit}>
        {mode === "register" && enteringEmail && (
          <label>
            표시 이름
            <input
              autoComplete="nickname"
              disabled={!ready}
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        )}
        {enteringEmail && (
          <label>
            이메일
            <input
              type="email"
              disabled={!ready}
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
        )}
        {enteringCode && (
          <label>
            인증번호
            <input
              type="text"
              inputMode="numeric"
              disabled={!ready}
              autoComplete="one-time-code"
              aria-label="인증번호"
              aria-describedby="email-code-hint"
              ref={codeInput}
              required
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={32}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))
              }
            />
            <small id="email-code-hint">
              가장 최근에 받은 번호를 입력해 주세요.
            </small>
          </label>
        )}
        {(mode === "login" || settingPassword) && !complete && (
          <label>
            {reset ? "새 비밀번호" : "비밀번호"}
            <input
              type="password"
              disabled={!ready}
              ref={passwordInput}
              aria-label={reset ? "새 비밀번호" : "비밀번호"}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={mode === "login" ? undefined : 8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {settingPassword && (
              <small>
                8자 이상, 문자와 숫자를 포함해 주세요. 특수문자는 선택이에요.
              </small>
            )}
          </label>
        )}
        {settingPassword && (
          <label>
            비밀번호 확인
            <input
              type="password"
              autoComplete="new-password"
              disabled={!ready}
              required
              maxLength={128}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {!complete && (
          <button disabled={busy || !ready}>{busy ? "처리 중…" : label}</button>
        )}
      </form>
      {(enteringCode || settingPassword) && !legacyLink && (
        <>
          <button
            className={styles.secondary}
            type="button"
            disabled={busy}
            onClick={resend}
          >
            인증번호 다시 받기
          </button>
          <button
            className={styles.secondary}
            type="button"
            disabled={busy}
            onClick={changeEmail}
          >
            이메일 변경
          </button>
        </>
      )}
      {complete && legacyLink && (
        <p>
          홈 화면에 추가한 한달살림을 사용 중이라면 홈 화면 아이콘을 다시 열어
          로그인해 주세요.
        </p>
      )}
      <div className={styles.links}>
        {mode !== "login" && (
          <Link href="/auth/login">로그인으로 돌아가기</Link>
        )}
        {mode === "login" && (
          <>
            <Link href="/auth/register">회원가입</Link>
            <Link href="/auth/forgot">비밀번호 찾기</Link>
            <Link href="/auth/resend">가입 인증번호 다시 받기</Link>
            {resumeSignup && (
              <Link href="/auth/register">진행 중인 가입 인증 계속하기</Link>
            )}
            {resumeReset && (
              <Link href="/auth/forgot">
                진행 중인 비밀번호 재설정 계속하기
              </Link>
            )}
          </>
        )}
        {legacyLink && !complete && (
          <Link href={reset ? "/auth/forgot" : "/auth/resend"}>
            인증번호 새로 받기
          </Link>
        )}
        {mode === "account" && <Link href="/settings">설정으로 돌아가기</Link>}
      </div>
    </main>
  );
}
