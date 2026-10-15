import Link from "next/link";
import {
  monthlySummary,
  won,
  type FixedCostDashboard,
} from "./fixedCostStatistics";
import styles from "./expense-summary.module.css";

export default function ExpenseSummary({ data }: { data: FixedCostDashboard }) {
  const summary = monthlySummary(data);
  return (
    <section className={styles.summary} aria-label="선택 월 지출 요약">
      <p className={styles.eyebrow}>
        {Number(data.month.slice(5))}월 실제 지출
      </p>
      <strong className={styles.amount}>{won(summary.actual)}</strong>
      <p className={styles.description}>
        {summary.count === 0
          ? "이 달에 예정된 지출이 없어요."
          : summary.pendingCount === 0
            ? "이번 달 청구를 모두 결제했어요."
            : `아직 결제하지 않은 지출이 ${summary.pendingCount}건 있어요.`}
      </p>
      {summary.count > 0 ? (
        <>
          <dl className={styles.totals}>
            <div>
              <dt>청구 예상액</dt>
              <dd>{won(summary.expected)}</dd>
            </div>
            <div>
              <dt>남은 예정액</dt>
              <dd>{won(summary.remaining)}</dd>
            </div>
          </dl>
          <div className={styles.progressLabel}>
            <span>결제 완료</span>
            <b>
              {summary.completedCount} / {summary.count}건
            </b>
          </div>
          <progress
            className={styles.progress}
            aria-label="청구 건수 기준 결제 완료"
            value={summary.completedCount}
            max={summary.count}
          />
          {summary.overdueCount > 0 && (
            <p className={styles.overdue}>
              결제일이 지난 미결제 지출 {summary.overdueCount}건
            </p>
          )}
          <p className={styles.note}>
            예정 결제월 기준 · 완료한 지출의 실제 결제액을 합산해요.
          </p>
        </>
      ) : (
        <div className={styles.empty}>
          <p>지출을 등록하고 결제를 완료하면 통계에 반영돼요.</p>
          <Link href="/entries/new">고정비 등록하기 →</Link>
        </div>
      )}
    </section>
  );
}
