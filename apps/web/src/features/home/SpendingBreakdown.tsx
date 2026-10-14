import type { DashboardCharge } from "./dashboard";
import {
  selectHomeSpendingEntries,
  type SpendingEntry,
} from "./spendingStatistics";
import styles from "./home-dashboard.module.css";
const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;
const dateLabel = (date: string) =>
  `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`;

export default function SpendingBreakdown({
  view,
  entries: allEntries,
  charges,
  month,
  onClose,
}: {
  view: "actual" | "remaining";
  entries: SpendingEntry[];
  charges: DashboardCharge[];
  month: string;
  onClose: () => void;
}) {
  const entries = selectHomeSpendingEntries(allEntries, month).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const pending = charges
    .filter((charge) => charge.status !== "완료")
    .sort((a, b) => a.dueDay - b.dueDay);
  const groups = new Map<string, SpendingEntry[]>();
  for (const entry of entries)
    groups.set(entry.date, [...(groups.get(entry.date) ?? []), entry]);
  const count = view === "actual" ? entries.length : pending.length;
  const total =
    view === "actual"
      ? entries.reduce((sum, entry) => sum + entry.amount, 0)
      : pending.reduce((sum, charge) => sum + charge.expectedAmount, 0);
  return (
    <section className={styles.breakdown} aria-labelledby="breakdown-title">
      <div className={styles.breakdownHeader}>
        <div>
          <h3 id="breakdown-title">
            {view === "actual" ? "실제 지출 내역" : "남은 지출 내역"}
          </h3>
          <p>
            {count}건 <span aria-hidden="true">·</span> {won(total)}
          </p>
        </div>
        <button
          type="button"
          className={styles.closeDetails}
          onClick={onClose}
          aria-label="지출 내역 닫기"
        >
          닫기 <span aria-hidden="true">×</span>
        </button>
      </div>
      {count === 0 && (
        <p className={styles.emptyBreakdown}>
          {view === "actual"
            ? "아직 지출한 내역이 없어요."
            : "남은 결제가 없어요."}
        </p>
      )}
      {view === "actual"
        ? [...groups].map(([date, items]) => (
            <div className={styles.dayGroup} key={date}>
              <div className={styles.groupHeading}>
                <h4>
                  <time dateTime={date}>{dateLabel(date)}</time>
                </h4>
                <span>
                  {won(items.reduce((sum, item) => sum + item.amount, 0))}
                </span>
              </div>
              <ul className={styles.expenseRows}>
                {items.map((entry) => (
                  <li key={entry.id}>
                    <div className={styles.rowInfo}>
                      <strong>{entry.name}</strong>
                      <span>
                        {entry.category}
                        {entry.paymentMethod ? ` · ${entry.paymentMethod}` : ""}
                      </span>
                    </div>
                    <strong className={styles.rowAmount}>
                      {won(entry.amount)}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          ))
        : ["지연", "예정"].map((status) => {
            const items = pending.filter((charge) => charge.status === status);
            if (!items.length) return null;
            return (
              <div className={styles.dayGroup} key={status}>
                <div
                  className={`${styles.groupHeading} ${status === "지연" ? styles.delayedGroup : ""}`}
                >
                  <h4>
                    {status === "지연" ? "지연" : "결제 예정"}{" "}
                    <span>{items.length}건</span>
                  </h4>
                  <span>
                    {won(
                      items.reduce((sum, item) => sum + item.expectedAmount, 0),
                    )}
                  </span>
                </div>
                <ul className={styles.expenseRows}>
                  {items.map((charge) => (
                    <li key={charge.id}>
                      <div className={styles.rowInfo}>
                        <strong>{charge.name}</strong>
                        <span>
                          {dateLabel(
                            charge.dueDate ??
                              `${month}-${String(charge.dueDay).padStart(2, "0")}`,
                          )}{" "}
                          · {charge.paymentMethod ?? "결제수단 미지정"}
                        </span>
                      </div>
                      <strong className={styles.rowAmount}>
                        {won(charge.expectedAmount)}
                      </strong>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
    </section>
  );
}
