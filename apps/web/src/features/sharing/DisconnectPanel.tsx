"use client";

import { useState } from "react";
import { decideDisconnect, requestDisconnect, type SharingState } from "./api";
import styles from "./sharing.module.css";

export default function DisconnectPanel({
  connection,
  busy,
  run,
  onChange,
}: {
  connection: NonNullable<SharingState["connection"]>;
  busy: boolean;
  run: (work: () => Promise<void>) => Promise<void>;
  onChange: (state: SharingState) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const pending = connection.disconnectRequest;
  const receiving = pending && !pending.requestedByMe;
  return (
    <section className={styles.disconnect} aria-label="함께 쓰기 연결 해제">
      <h3>연결 해제</h3>
      <p>
        한 사람이 요청하고 상대가 수락해야 해제됩니다. 수락 전까지는 함께 쓰기를
        유지합니다.
      </p>
      {pending ? (
        <>
          <p role="status">
            {pending.requestedByMe
              ? "연결 해제를 요청했어요. 상대의 수락을 기다리고 있어요."
              : `${connection.partnerName}님이 연결 해제를 요청했어요.`}
          </p>
          <p>
            요청 유효기간:{" "}
            {new Date(pending.expiresAt).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}
          </p>
          {receiving ? (
            <div className={styles.actions}>
              <button disabled={busy} onClick={() => setConfirming(true)}>
                해제 요청 확인
              </button>
              <button
                className={styles.secondary}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    onChange(await decideDisconnect(pending.id, "REJECT"));
                    setConfirming(false);
                  })
                }
              >
                해제 거절
              </button>
            </div>
          ) : (
            <button
              className={styles.secondary}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  onChange(await decideDisconnect(pending.id, "CANCEL"));
                  setConfirming(false);
                })
              }
            >
              해제 요청 취소
            </button>
          )}
        </>
      ) : (
        <button
          className={styles.textButton}
          disabled={busy}
          onClick={() => setConfirming(true)}
        >
          연결 해제 요청
        </button>
      )}
      {confirming && (!pending || receiving) && (
        <section className={styles.confirm} aria-label="연결 해제 확인">
          <h3>{connection.partnerName}님과 연결을 해제하시겠어요?</h3>
          <p>
            두 사람이 동의하면 함께 쓰기가 종료됩니다. 함께 쓴 가계부는 두 사람
            모두 읽기 전용으로 보존되고, 이후 내역은 각자의 새 개인 가계부에
            등록됩니다.
          </p>
          <p>
            공유 잔액·반복 고정비·결제수단·사용자 분류는 자동으로 옮기지
            않습니다. 다시 연결해도 새 공유 가계부로 시작합니다.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (receiving) {
                  await decideDisconnect(pending.id, "ACCEPT");
                  window.location.replace("/settings/sharing");
                } else {
                  onChange(await requestDisconnect(connection.spaceId));
                  setConfirming(false);
                }
              })
            }
          >
            {receiving ? "동의하고 연결 해제" : "상대에게 해제 요청 보내기"}
          </button>
          <button
            className={styles.secondary}
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            돌아가기
          </button>
        </section>
      )}
      <p>
        자동 알림은 없어요. 요청 상태 새로고침으로 확인해 주세요. 해제 요청은
        24시간 동안 유효합니다.
      </p>
    </section>
  );
}
