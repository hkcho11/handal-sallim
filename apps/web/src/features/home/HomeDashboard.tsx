import Link from "next/link";
import { MOCK_DASHBOARD, summarizeCharges } from "./mockDashboard";
import styles from "./home-dashboard.module.css";

const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;
const statusStyles = {
  예정: styles.pending,
  완료: styles.completed,
  지연: styles.overdue,
};

export default function HomeDashboard() {
  const { charges, finances, month, referenceDate } = MOCK_DASHBOARD;
  const totals = summarizeCharges(charges);
  const methods = [...new Set(charges.map((charge) => charge.paymentMethod))];

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>우리 집 생활비 한눈에</p>
            <h1>한달살림</h1>
          </div>
          <Link className={styles.add} href="/entries/new">
            + 내역 추가
          </Link>
        </header>
        <div className={styles.month}>
          <h2>{month}</h2>
          <span>예시 데이터 · {referenceDate}</span>
        </div>
        <p className={styles.preview}>
          대시보드 미리보기입니다. 표시된 금액과 일정은 실제 등록 내역과
          연결되지 않습니다.
        </p>

        <div className={styles.primaryGrid}>
          <section className={styles.panel} aria-labelledby="timeline-title">
            <div className={styles.sectionHeader}>
              <h2 id="timeline-title">이번 달 고정비 타임라인</h2>
              <Link href="/fixed-costs">고정비 관리 →</Link>
            </div>
            <p className={styles.muted}>미결제 항목부터 확인하세요.</p>
            <ul className={styles.timeline}>
              {charges.map((charge) => (
                <li key={charge.id} className={styles.charge}>
                  <div className={styles.date}>
                    <span>10월</span>
                    <strong>{charge.dueDay}일</strong>
                  </div>
                  <div className={styles.chargeInfo}>
                    <div className={styles.chargeTitle}>
                      <h3>{charge.name}</h3>
                      <span
                        className={`${styles.badge} ${statusStyles[charge.status]}`}
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
                    <strong>
                      {won(charge.actualAmount ?? charge.expectedAmount)}
                    </strong>
                    <span>
                      {charge.status === "완료" ? "실제 결제액" : "예상 금액"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section
            className={`${styles.panel} ${styles.summary}`}
            aria-labelledby="summary-title"
          >
            <h2 id="summary-title">이번 달 결제 현황</h2>
            <div className={styles.attention}>
              <strong>미결제 {totals.pendingCount}건</strong>
              <span>지연 {totals.overdueCount}건 포함</span>
            </div>
            <p className={styles.muted}>앞으로 결제할 금액</p>
            <p className={styles.largeAmount}>{won(totals.remaining)}</p>
            <dl className={styles.metrics}>
              <div>
                <dt>월 예상 총액</dt>
                <dd>{won(totals.expected)}</dd>
              </div>
              <div>
                <dt>확정 결제액</dt>
                <dd>{won(totals.confirmed)}</dd>
              </div>
              <div>
                <dt>결제 완료</dt>
                <dd>
                  {totals.completedCount} / {charges.length}건
                </dd>
              </div>
            </dl>
            <progress
              aria-label="고정비 결제 완료"
              value={totals.completedCount}
              max={charges.length}
            />
            <p className={styles.summaryNote}>
              예상 총액은 최초 예상 금액의 합계이며, 확정액은 실제 결제 금액으로
              표시합니다.
            </p>
          </section>
        </div>

        <section className={styles.panel} aria-labelledby="methods-title">
          <h2 id="methods-title">결제수단별 이번 달 금액</h2>
          <p className={styles.muted}>어디에서 얼마나 나가는지 확인하세요.</p>
          <div className={styles.methodGrid}>
            {methods.map((method) => {
              const summary = summarizeCharges(
                charges.filter((charge) => charge.paymentMethod === method),
              );
              return (
                <article className={styles.method} key={method ?? "unassigned"}>
                  <h3>{method ?? "결제수단 미지정"}</h3>
                  <dl className={styles.metrics}>
                    <div>
                      <dt>예상액</dt>
                      <dd>{won(summary.expected)}</dd>
                    </div>
                    <div>
                      <dt>확정액</dt>
                      <dd>{won(summary.confirmed)}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="finances-title">
          <h2 id="finances-title">이번 달 수입·지출</h2>
          <p className={styles.muted}>
            공동 생활비와 내 개인 내역을 구분해 보여줍니다.
          </p>
          <div className={styles.financeGrid}>
            {finances.map((finance, index) => (
              <article className={styles.method} key={finance.name}>
                <h3>{finance.name}</h3>
                <dl className={styles.metrics}>
                  <div>
                    <dt>수입</dt>
                    <dd>{won(finance.income)}</dd>
                  </div>
                  <div>
                    <dt>지출</dt>
                    <dd>
                      {won(
                        finance.otherExpenses +
                          (index === 0 ? totals.confirmed : 0),
                      )}
                    </dd>
                  </div>
                </dl>
                <p className={styles.summaryNote}>
                  {index === 0
                    ? "완료된 공동 고정비와 일반 지출 포함"
                    : "나에게만 보이는 개인 내역 예시"}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
