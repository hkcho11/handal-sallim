import { MOCK_DASHBOARD } from "./mockDashboard";
import {
  MOCK_SPENDING_ENTRIES,
  selectHomeSpendingEntries,
} from "./spendingStatistics";
import styles from "./home-dashboard.module.css";

const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

export default function SpendingBreakdown({
  view,
}: {
  view: "actual" | "remaining";
}) {
  const entries = selectHomeSpendingEntries(
    MOCK_SPENDING_ENTRIES,
    "2026-10",
  ).sort((a, b) => b.date.localeCompare(a.date));
  const pending = MOCK_DASHBOARD.charges
    .filter((charge) => charge.status !== "완료")
    .sort(
      (a, b) =>
        Number(b.status === "지연") - Number(a.status === "지연") ||
        a.dueDay - b.dueDay,
    );
  return (
    <section className={styles.breakdown} aria-labelledby="breakdown-title">
      <h3 id="breakdown-title">
        {view === "actual" ? "실제 지출 내역" : "남은 지출 내역"}
      </h3>
      {view === "actual" ? (
        <ul className={styles.categoryEntries}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <span>
                <span>{entry.name}</span>
                <small>
                  {entry.date} · {entry.category} · {entry.scope} · 완료
                </small>
              </span>
              <strong>{won(entry.amount)}</strong>
            </li>
          ))}
        </ul>
      ) : (
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
      )}
    </section>
  );
}
