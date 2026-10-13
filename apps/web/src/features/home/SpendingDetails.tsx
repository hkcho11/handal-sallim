import Link from "next/link";
import { MOCK_DASHBOARD, summarizeCharges } from "./mockDashboard";
import {
  MOCK_SPENDING_ENTRIES,
  calculateSpendingStatistics,
} from "./spendingStatistics";
import styles from "./home-dashboard.module.css";

const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;
const VIEWS = {
  actual: {
    title: "실제 지출 내역",
    description:
      "결제 완료된 고정비와 일반 지출을 합산합니다. 공동 생활비와 내 개인 지출을 포함합니다.",
  },
  remaining: {
    title: "남은 예정 지출 내역",
    description:
      "아직 결제하지 않은 고정비의 예상 금액입니다. 결제일이 지난 지연 항목도 포함합니다.",
  },
  projected: {
    title: "월말 예상 지출 내역",
    description:
      "실제 지출과 남은 고정비 예정액을 합산합니다. 앞으로 발생할 일반 지출은 포함하지 않습니다.",
  },
};

export default function SpendingDetails({
  view,
}: {
  view: keyof typeof VIEWS;
}) {
  const remaining = summarizeCharges(MOCK_DASHBOARD.charges).remaining;
  const statistics = calculateSpendingStatistics(
    MOCK_SPENDING_ENTRIES,
    remaining,
    "2026-10",
  );
  const total =
    view === "actual"
      ? statistics.spent
      : view === "remaining"
        ? remaining
        : statistics.projected;
  const entries = [...MOCK_SPENDING_ENTRIES].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const pending = MOCK_DASHBOARD.charges
    .filter((charge) => charge.status !== "완료")
    .sort(
      (a, b) =>
        Number(b.status === "지연") - Number(a.status === "지연") ||
        a.dueDay - b.dueDay,
    );
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header>
          <Link className={styles.detailBack} href="/">
            ← 홈으로
          </Link>
          <p className={styles.muted}>{MOCK_DASHBOARD.month} · 예시 데이터</p>
          <h1>{VIEWS[view].title}</h1>
        </header>
        <section
          className={`${styles.panel} ${styles.summary}`}
          aria-label="합계와 계산 기준"
        >
          <h2>합계</h2>
          <p className={styles.statAmount}>{won(total)}</p>
          {view === "projected" && (
            <p>
              {won(statistics.spent)} + {won(remaining)} = {won(total)}
            </p>
          )}
          <p className={styles.muted}>{VIEWS[view].description}</p>
          <p className={styles.summaryNote}>
            예시 내역이며 실제 등록 고정비와 연결되지 않습니다.
          </p>
        </section>
        {view !== "remaining" && (
          <section
            className={styles.panel}
            aria-labelledby="actual-details-title"
          >
            <div className={styles.sectionHeader}>
              <h2 id="actual-details-title">결제 완료된 지출</h2>
              <strong>{won(statistics.spent)}</strong>
            </div>
            <ul className={styles.categoryEntries}>
              {entries.map((entry) => (
                <li key={entry.id}>
                  <span>
                    {entry.name}
                    <small>
                      {entry.date} · {entry.category} · {entry.scope}
                    </small>
                  </span>
                  <strong>{won(entry.amount)}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}
        {view !== "actual" && (
          <section
            className={styles.panel}
            aria-labelledby="pending-details-title"
          >
            <div className={styles.sectionHeader}>
              <h2 id="pending-details-title">미결제 고정비</h2>
              <strong>{won(remaining)}</strong>
            </div>
            <ul className={styles.timeline}>
              {pending.map((charge) => (
                <li className={styles.charge} key={charge.id}>
                  <div className={styles.date}>
                    <span>10월</span>
                    <strong>{charge.dueDay}일</strong>
                  </div>
                  <div className={styles.chargeInfo}>
                    <div className={styles.chargeTitle}>
                      <h3>{charge.name}</h3>
                      <span
                        className={`${styles.badge} ${charge.status === "지연" ? styles.overdue : styles.pending}`}
                      >
                        {charge.status}
                      </span>
                    </div>
                    <p>
                      담당자 {charge.payer ?? "미지정"} ·{" "}
                      {charge.paymentMethod ?? "결제수단 미지정"}
                    </p>
                  </div>
                  <div className={styles.amount}>
                    <strong>{won(charge.expectedAmount)}</strong>
                    <span>예상 금액</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
