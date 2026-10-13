import Link from "next/link";
import { MOCK_DASHBOARD, summarizeCharges } from "./mockDashboard";
import styles from "./home-dashboard.module.css";
import RegisteredExpenses from "./RegisteredExpenses";
import MonthlySpending from "./MonthlySpending";

const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

export default function HomeDashboard() {
  const { charges, month, referenceDate } = MOCK_DASHBOARD;
  const totals = summarizeCharges(charges);
  const methods = [...new Set(charges.map((charge) => charge.paymentMethod))];
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>한달살림</h1>
          <Link className={styles.add} href="/entries/new">
            + 내역 추가
          </Link>
        </header>
        <div className={styles.month}>
          <h2>{month}</h2>
          <span>{referenceDate}</span>
        </div>
        <MonthlySpending remaining={totals.remaining} />
        <RegisteredExpenses compact />
        <section className={styles.panel} aria-labelledby="methods-title">
          <div className={styles.sectionHeader}>
            <h2 id="methods-title">결제수단별 금액</h2>
            <span className={styles.badge}>예시</span>
          </div>
          <div className={styles.paymentTable}>
            <div className={styles.paymentHead}>
              <span>결제수단</span>
              <span>예상</span>
              <span>확정</span>
            </div>
            {methods.map((method) => {
              const summary = summarizeCharges(
                charges.filter((charge) => charge.paymentMethod === method),
              );
              return (
                <div key={method ?? "unassigned"} className={styles.paymentRow}>
                  <span>{method ?? "미지정"}</span>
                  <strong>{won(summary.expected)}</strong>
                  <strong>{won(summary.confirmed)}</strong>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
