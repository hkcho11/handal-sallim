"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadSharing,
  lookupMember,
  sendRequest,
  decideRequest,
  rotateCode,
  type SharingState,
  type SharingRequest,
  type Member,
} from "./api";
import styles from "./sharing.module.css";
import DisconnectPanel from "./DisconnectPanel";
const statuses = {
  PENDING: "확인 대기",
  ACCEPTED: "연결 완료",
  REJECTED: "거절됨",
  CANCELLED: "취소됨",
  EXPIRED: "만료됨",
};
const policy =
  "연결 후 새로 등록하는 수입·지출·저축은 함께 조회·수정·삭제합니다. 이전 기록은 각자에게만 보존됩니다.";
export default function SharingScreen() {
  const [state, setState] = useState<SharingState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [accepting, setAccepting] = useState<SharingRequest | null>(null);
  const [rotating, setRotating] = useState(false);
  useEffect(() => {
    let active = true;
    loadSharing()
      .then((value) => {
        if (active) setState(value);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "연결 정보를 불러오지 못했습니다.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "요청을 처리하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.screen} aria-busy={busy}>
      <header>
        <Link href="/settings">← 설정</Link>
        <h1>함께 쓰기</h1>
      </header>
      <p>회원코드로 요청을 보내고 상대가 수락하면 함께 쓰기를 시작해요.</p>
      <button
        className={styles.secondary}
        disabled={busy}
        onClick={() =>
          void run(async () => {
            setState(await loadSharing());
            setMember(null);
            setAccepting(null);
            setRotating(false);
            setNotice("최신 상태를 불러왔어요.");
          })
        }
      >
        요청 상태 새로고침
      </button>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!state && !error && <p role="status">연결 정보를 불러오고 있어요.</p>}
      {state && (
        <>
          <section className={styles.card}>
            <h2>내 회원코드</h2>
            <p className={styles.code} aria-label="내 회원코드">
              {state.memberCode}
            </p>
            <p>
              상대에게 이 코드를 알려주세요. 코드를 알려줘도 기록은 공개되지
              않아요.
            </p>
            <button
              className={styles.secondary}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (!navigator.clipboard)
                    throw new Error(
                      "자동 복사를 사용할 수 없어요. 표시된 회원코드를 직접 입력해 주세요.",
                    );
                  await navigator.clipboard.writeText(state.memberCode);
                  setNotice("회원코드를 복사했어요.");
                })
              }
            >
              회원코드 복사
            </button>
            {!state.connection && (
              <button
                className={styles.textButton}
                disabled={busy}
                onClick={() => setRotating(true)}
              >
                회원코드 재발급
              </button>
            )}
            {rotating && (
              <div className={styles.confirm}>
                <p>
                  기존 코드는 다시 사용할 수 없고, 받은 대기 요청도 취소됩니다.
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setState(await rotateCode());
                      setRotating(false);
                      setNotice("회원코드를 새로 만들었어요.");
                    })
                  }
                >
                  새 코드 발급
                </button>
                <button
                  className={styles.secondary}
                  disabled={busy}
                  onClick={() => setRotating(false)}
                >
                  돌아가기
                </button>
              </div>
            )}
          </section>
          {state.connection ? (
            <section className={styles.card}>
              <h2>{state.connection.partnerName}님과 함께 쓰는 중</h2>
              <p>
                공유 시작:{" "}
                {new Date(state.connection.startedAt).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </p>
              <p>{policy}</p>
              <button onClick={() => window.location.replace("/")}>
                공유 가계부 열기
              </button>
              <DisconnectPanel
                key={`${state.connection.spaceId}-${state.connection.disconnectRequest?.id ?? "none"}`}
                connection={state.connection}
                busy={busy}
                run={run}
                onChange={setState}
              />
            </section>
          ) : (
            <>
              <section className={styles.card}>
                <h2>상대에게 요청하기</h2>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      setMember(await lookupMember(code));
                    });
                  }}
                >
                  <label>
                    상대 회원코드
                    <input
                      autoComplete="off"
                      maxLength={20}
                      placeholder="7KMP-4XQ9"
                      value={code}
                      onChange={(event) => {
                        setCode(event.target.value);
                        setMember(null);
                      }}
                      required
                    />
                  </label>
                  <button disabled={busy}>상대 확인</button>
                </form>
                {member && (
                  <div className={styles.confirm}>
                    <h3>{member.name}님이 맞나요?</h3>
                    <p>{member.memberCode}</p>
                    <p>{policy}</p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          setState(await sendRequest(member.memberCode));
                          setMember(null);
                          setCode("");
                          setNotice(
                            "연결 요청을 보냈어요. 상대의 수락을 기다려 주세요.",
                          );
                        })
                      }
                    >
                      이 사람에게 함께 쓰기 요청
                    </button>
                  </div>
                )}
              </section>
              <section className={styles.card}>
                <h2>받은 요청</h2>
                {state.received.length === 0 && <p>받은 요청이 없어요.</p>}
                {state.received.map((request) => (
                  <article className={styles.request} key={request.id}>
                    <strong>{request.name}</strong>
                    <span>
                      {request.memberCode} · {statuses[request.status]}
                    </span>
                    {request.status === "PENDING" && (
                      <>
                        <small>
                          유효기간:{" "}
                          {new Date(request.expiresAt).toLocaleString("ko-KR", {
                            timeZone: "Asia/Seoul",
                          })}
                        </small>
                        <div className={styles.actions}>
                          <button
                            disabled={busy}
                            onClick={() => setAccepting(request)}
                          >
                            요청 확인
                          </button>
                          <button
                            className={styles.secondary}
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                setState(
                                  await decideRequest(request.id, "REJECT"),
                                );
                                setAccepting(null);
                                setNotice("연결 요청을 거절했어요.");
                              })
                            }
                          >
                            거절
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </section>
              {accepting && (
                <section
                  className={`${styles.card} ${styles.confirm}`}
                  aria-label="연결 수락 확인"
                >
                  <h2>{accepting.name}님과 함께 쓰시겠어요?</h2>
                  <p>회원코드 {accepting.memberCode}</p>
                  <p>{policy}</p>
                  <p>
                    반복 고정비는 앞으로의 회차만 이어받습니다. 같은 비용이
                    양쪽에 있다면 연결 후 중복 항목을 정리해 주세요.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await decideRequest(accepting.id, "ACCEPT");
                        window.location.replace("/");
                      })
                    }
                  >
                    이 사람과 함께 쓰기 시작
                  </button>
                  <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => setAccepting(null)}
                  >
                    돌아가기
                  </button>
                </section>
              )}
              <section className={styles.card}>
                <h2>보낸 요청</h2>
                {state.sent.length === 0 && <p>보낸 요청이 없어요.</p>}
                {state.sent.map((request) => (
                  <article className={styles.request} key={request.id}>
                    <strong>{request.name}</strong>
                    <span>
                      {request.memberCode} · {statuses[request.status]}
                    </span>
                    {request.status === "PENDING" && (
                      <button
                        className={styles.secondary}
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            setState(await decideRequest(request.id, "CANCEL"));
                            setNotice("연결 요청을 취소했어요.");
                          })
                        }
                      >
                        요청 취소
                      </button>
                    )}
                  </article>
                ))}
              </section>
            </>
          )}
          <Link className={styles.archiveLink} href="/settings/sharing/history">
            보존된 이전 기록 보기 →
          </Link>
          <p>
            요청이나 수락 후에는 새로고침으로 최신 상태를 확인해 주세요. 요청은
            24시간 동안 유효합니다.
          </p>
        </>
      )}
    </main>
  );
}
