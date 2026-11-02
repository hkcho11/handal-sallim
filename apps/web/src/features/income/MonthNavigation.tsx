import styles from "./income.module.css";

export function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${Number(year)}년 ${Number(month)}월`;
}

function adjacentMonth(value: string, offset: number) {
  const [year, month] = value.split("-").map(Number);
  const index = year * 12 + month - 1 + offset;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export default function MonthNavigation({
  label,
  value,
  today,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  today: string;
  disabled?: boolean;
  onChange: (month: string) => void;
}) {
  return (
    <div className={styles.monthField} role="group" aria-label={label}>
      <div className={styles.monthCaption}>
        <span>{label}</span>
        {value !== today && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(today)}
          >
            이번 달
          </button>
        )}
      </div>
      <div className={styles.monthNavigation}>
        <button
          type="button"
          aria-label="이전 달"
          disabled={disabled || value === "0001-01"}
          onClick={() => onChange(adjacentMonth(value, -1))}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <span aria-live="polite" aria-atomic="true">
          {monthLabel(value)}
        </span>
        <button
          type="button"
          aria-label="다음 달"
          disabled={disabled || value === "9999-12"}
          onClick={() => onChange(adjacentMonth(value, 1))}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}
