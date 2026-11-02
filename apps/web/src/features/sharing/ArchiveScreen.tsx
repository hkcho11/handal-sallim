"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadArchives, type Archive } from "./api";
import styles from "./sharing.module.css";
const kinds: Record<string, string> = {
  INCOME: "수입",
  SAVINGS: "저축",
  CHARGE: "결제 내역",
  TRANSACTION: "기존 거래",
  FIXED_SETTING: "고정비 설정",
};
const states: Record<string, string> = {
  PRESERVED: "보존",
  PENDING: "예정",
  COMPLETED: "완료",
  CANCELLED: "취소",
  ACTIVE: "사용 중",
  PAUSED: "일시 중지",
  ENDED: "종료",
  VOIDED: "취소",
};
export default function ArchiveScreen() {
  const [archives, setArchives] = useState<Archive[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadArchives()
      .then((value) => {
        if (active) setArchives(value);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "기록을 불러오지 못했습니다.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className={styles.screen}>
      <Link href="/settings/sharing">← 함께 쓰기</Link>
      <h1>보존된 이전 기록</h1>
      <p>
        연결 전 개인 기록은 본인만, 해제한 공유 기록은 당시 두 멤버만 볼 수
        있어요. 모두 읽기 전용이며 현재 가계부의 합계에는 포함되지 않습니다.
      </p>
      {error && <p role="alert">{error}</p>}
      {!archives && !error && <p role="status">기록을 불러오고 있어요.</p>}
      {archives?.length === 0 && <p>보존된 과거 기록이 없어요.</p>}
      {archives?.map((archive) => (
        <section className={styles.card} key={archive.spaceId}>
          <h2>{archive.spaceName}</h2>
          <p>
            {archive.scope === "SHARED"
              ? "함께 쓴 기록 · 당시 두 멤버에게 보존"
              : "연결 전 개인 기록 · 본인만 열람"}
          </p>
          <p>
            {new Date(archive.archivedAt).toLocaleDateString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}{" "}
            이전 기록
          </p>
          {archive.entries.length === 0 && <p>등록된 기록이 없어요.</p>}
          {Object.entries(kinds).map(([kind, label]) => {
            const entries = archive.entries.filter(
              (entry) => entry.kind === kind,
            );
            return (
              entries.length > 0 && (
                <section key={kind}>
                  <h3>{label}</h3>
                  <ul className={styles.entries}>
                    {entries.map((entry, index) => (
                      <li key={index}>
                        <div>
                          <strong>{entry.name}</strong>
                          <small>
                            {entry.date ?? "날짜 없음"} ·{" "}
                            {states[entry.status] ?? "보존"}
                          </small>
                        </div>
                        {entry.amount !== null && (
                          <span>{entry.amount.toLocaleString("ko-KR")}원</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )
            );
          })}
        </section>
      ))}
    </main>
  );
}
