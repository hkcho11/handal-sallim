"use client";

import { useState } from "react";
import Link from "next/link";
import {
  categoryStatistics,
  monthlyChanges,
  paymentStatistics,
  won,
  type FixedCostDashboard,
  type FixedCostCharge,
} from "./fixedCostStatistics";
import styles from "./fixed-cost-dashboard.module.css";
import ExpenseSummary from "./ExpenseSummary";
const unknown = "unclassified";
const compactWon = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const signedWon = (amount: number) =>
  `${amount > 0 ? "+" : amount < 0 ? "−" : ""}${won(Math.abs(amount))}`;
function changeLabel(change: number | null, percentage: number | null) {
  if (change === null) return "비교 기록 없음";
  return `${signedWon(change)} (${percentage === null ? "—" : `${percentage > 0 ? "+" : ""}${percentage.toFixed(1)}%`})`;
}
function chargeLabel(charge: FixedCostCharge) {
  return charge.status === "완료"
    ? `${won(charge.actualAmount ?? 0)} · 완료`
    : `${won(charge.expectedAmount)} · ${charge.status}`;
}
export default function FixedCostInsights({
  data,
}: {
  data: FixedCostDashboard;
}) {
  const statistics = categoryStatistics(data);
  const first =
    data.classifications.find((c) => c.subcategoryName === "전기") ??
    data.classifications.find((c) =>
      statistics.charges.some(
        (charge) => charge.subcategoryId === c.subcategoryId,
      ),
    ) ??
    data.classifications[0];
  const [parent, setParent] = useState(first?.categoryId ?? unknown);
  const [sub, setSub] = useState(first?.subcategoryId ?? unknown);
  const [trendMonth, setTrendMonth] = useState(data.month);
  const [amountView, setAmountView] = useState<"actual" | "expected">(
    "expected",
  );
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const parents = [
    ...new Map(
      data.classifications.map((c) => [
        c.categoryId,
        { id: c.categoryId, name: c.categoryName },
      ]),
    ).values(),
  ];
  if (
    data.charges.some((charge) => charge.categoryId === null) ||
    !parents.length
  )
    parents.push({ id: unknown, name: "대분류 미지정" });
  const subcategories = data.classifications
    .filter((c) => c.categoryId === parent)
    .map((c) => ({ id: c.subcategoryId, name: c.subcategoryName }));
  if (
    data.charges.some(
      (charge) =>
        (charge.categoryId ?? unknown) === parent &&
        charge.subcategoryId === null,
    ) ||
    !subcategories.length
  )
    subcategories.push({ id: unknown, name: "중분류 미지정" });
  const selectedSub = subcategories.some((c) => c.id === sub)
    ? sub
    : subcategories[0].id;
  const changes = monthlyChanges(
    data,
    selectedSub === unknown ? null : selectedSub,
    parent === unknown ? null : parent,
  );
  const selectedName =
    subcategories.find((c) => c.id === selectedSub)?.name ?? "중분류 미지정";
  const selectedPoint =
    changes.find((point) => point.month === trendMonth) ??
    changes[changes.length - 1];
  const methods = paymentStatistics(data);
  const total =
    amountView === "actual" ? statistics.actual : statistics.expected;
  const maximum = Math.max(
    1,
    ...statistics.categories.map((c) => c[amountView]),
  );
  const trendMaximum = Math.max(
    1,
    ...changes.map((point) => point.amount ?? 0),
  );
  const pending = statistics.charges.filter(
    (charge) => charge.status !== "완료",
  );
  function selectParent(id: string) {
    setParent(id);
    setSub(
      data.classifications.find((c) => c.categoryId === id)?.subcategoryId ??
        unknown,
    );
  }
  return (
    <>
      <ExpenseSummary data={data} />
      <section className={styles.panel} aria-labelledby="major-title">
        <div className={styles.sectionHeader}>
          <h2 id="major-title">대분류별 지출 통계</h2>
          <div
            className={styles.segmented}
            role="group"
            aria-label="대분류 집계 금액"
          >
            <button
              type="button"
              aria-pressed={amountView === "actual"}
              onClick={() => setAmountView("actual")}
            >
              실제
            </button>
            <button
              type="button"
              aria-pressed={amountView === "expected"}
              onClick={() => setAmountView("expected")}
            >
              예상
            </button>
          </div>
        </div>
        <div className={styles.total}>
          <span>{amountView === "actual" ? "실제 결제액" : "예정 청구액"}</span>
          <strong>{won(total)}</strong>
          <small>
            {amountView === "actual"
              ? `완료 ${statistics.charges.filter((charge) => charge.status === "완료").length}건`
              : `청구 ${statistics.charges.length}건`}
          </small>
        </div>
        {statistics.categories.length ? (
          <div className={styles.categoryList}>
            {statistics.categories.map((category) => {
              const key = category.id ?? unknown;
              return (
                <div key={key} className={styles.category}>
                  <button
                    type="button"
                    className={styles.categoryButton}
                    aria-expanded={expandedCategory === key}
                    aria-controls={`category-${key}`}
                    onClick={() => {
                      setExpandedCategory((current) =>
                        current === key ? null : key,
                      );
                      selectParent(key);
                    }}
                  >
                    <span className={styles.categoryHeading}>
                      <strong>{category.name}</strong>
                      <span>
                        <b>{won(category[amountView])}</b>
                        <small>
                          {total
                            ? `${((category[amountView] / total) * 100).toFixed(1)}%`
                            : "—"}
                          <span aria-hidden="true">
                            {" "}
                            {expandedCategory === key ? "⌃" : "⌄"}
                          </span>
                        </small>
                      </span>
                    </span>
                    <span className={styles.bar} aria-hidden="true">
                      <span
                        style={{
                          width: `${(category[amountView] / maximum) * 100}%`,
                        }}
                      />
                    </span>
                  </button>
                  <div id={`category-${key}`} hidden={expandedCategory !== key}>
                    <ul className={styles.entryList}>
                      {category.items.map((charge) => (
                        <li key={charge.id}>
                          <Link
                            href={`/fixed-costs/${charge.recurringExpenseId}`}
                          >
                            <span>
                              {charge.name}
                              <small>
                                {charge.subcategoryName ?? "중분류 미지정"}
                              </small>
                            </span>
                            <b>{chargeLabel(charge)}</b>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty}>이 달에 등록된 고정비 청구가 없어요.</p>
        )}
        {pending.length > 0 && (
          <div className={styles.pendingNote}>
            <span>미결제 {pending.length}건</span>
            <b>
              예정{" "}
              {won(
                pending.reduce((sum, charge) => sum + charge.expectedAmount, 0),
              )}
            </b>
          </div>
        )}
        {pending.length > 0 && amountView === "actual" && (
          <p className={styles.note}>미결제 건은 실제액 0원으로 표시합니다.</p>
        )}
      </section>
      <section className={styles.panel} aria-labelledby="trend-title">
        <div className={styles.sectionHeader}>
          <h2 id="trend-title">중분류별 월별 변화</h2>
          <span className={styles.note}>최근 6개월</span>
        </div>
        <div className={styles.selectors}>
          <label>
            대분류
            <select
              aria-label="대분류"
              value={parent}
              onChange={(event) => selectParent(event.target.value)}
            >
              {parents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            중분류
            <select
              aria-label="중분류"
              value={selectedSub}
              onChange={(event) => setSub(event.target.value)}
            >
              {subcategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          className={styles.trendHeadline}
          aria-live="polite"
          aria-atomic="true"
        >
          <span>
            {selectedName} · {Number(selectedPoint.month.slice(0, 4))}년{" "}
            {Number(selectedPoint.month.slice(5))}월
          </span>
          <strong>
            {selectedPoint.amount === null
              ? "기록 없음"
              : won(selectedPoint.amount)}
          </strong>
          <p>
            전월 대비{" "}
            <b>{changeLabel(selectedPoint.change, selectedPoint.percentage)}</b>
          </p>
          {selectedPoint.pendingCount > 0 && (
            <p>
              미결제 {selectedPoint.pendingCount}건 · 예정{" "}
              {won(selectedPoint.expected)}
            </p>
          )}
        </div>
        <p className={styles.chartUnit}>단위: 원</p>
        <div
          className={styles.trendChart}
          role="group"
          aria-label={`${selectedName} 최근 6개월 실제 결제액`}
        >
          {changes.map((point) => (
            <button
              type="button"
              className={styles.trendColumn}
              key={point.month}
              aria-pressed={point.month === selectedPoint.month}
              aria-label={`${Number(point.month.slice(0, 4))}년 ${Number(point.month.slice(5))}월, ${point.amount === null ? "기록 없음" : won(point.amount)}, 전월 대비 ${changeLabel(point.change, point.percentage)}${point.pendingCount ? `, 미결제 ${point.pendingCount}건` : ""}`}
              onClick={() => setTrendMonth(point.month)}
            >
              <span className={styles.trendValue} aria-hidden="true">
                {point.amount === null ? "—" : compactWon.format(point.amount)}
              </span>
              <span className={styles.trendTrack} aria-hidden="true">
                {point.amount === null ? (
                  <span className={styles.noRecord}>·</span>
                ) : (
                  <span
                    className={styles.trendBar}
                    data-current={point.month === selectedPoint.month}
                    style={{
                      height:
                        point.amount === 0
                          ? "2px"
                          : `${(point.amount / trendMaximum) * 100}%`,
                    }}
                  />
                )}
              </span>
              <span className={styles.trendMonth} aria-hidden="true">
                {Number(point.month.slice(5))}월
              </span>
            </button>
          ))}
        </div>
        <p className={styles.note}>
          막대를 누르면 정확한 금액과 증감을 볼 수 있어요.
        </p>
        <p className={styles.note}>예정 결제월 기준 · 실제 결제액 비교</p>
      </section>
      <section className={styles.panel} aria-labelledby="payments-title">
        <div className={styles.sectionHeader}>
          <h2 id="payments-title">결제수단별 지출</h2>
        </div>
        {methods.length ? (
          <>
            <div className={styles.paymentHead}>
              <span>결제수단</span>
              <span>실제</span>
              <span>미결제 예정</span>
            </div>
            {methods.map((method) => (
              <div
                key={method.id ?? "unassigned"}
                className={styles.paymentRow}
              >
                <strong>{method.name}</strong>
                <span>{won(method.actual)}</span>
                <span>{won(method.planned)}</span>
              </div>
            ))}
          </>
        ) : (
          <p className={styles.empty}>이 달의 결제수단 내역이 없어요.</p>
        )}
        <p className={styles.note}>
          완료 건은 실제 결제수단, 미결제 건은 예정 결제수단에 집계합니다.
        </p>
      </section>
      <details className={styles.panel}>
        <summary className={styles.scheduleSummary}>
          결제 일정·미결제 내역 <span>미결제 {pending.length}건 ⌄</span>
        </summary>
        <ul className={styles.entryList}>
          {[...statistics.charges]
            .sort(
              (a, b) =>
                Number(b.status === "지연") - Number(a.status === "지연") ||
                a.dueDate.localeCompare(b.dueDate),
            )
            .map((charge) => (
              <li key={charge.id}>
                <Link href={`/fixed-costs/${charge.recurringExpenseId}`}>
                  <span>
                    {charge.name}
                    <small>
                      {charge.dueDate} · {charge.status}
                    </small>
                  </span>
                  <b>
                    {won(
                      charge.status === "완료"
                        ? (charge.actualAmount ?? 0)
                        : charge.expectedAmount,
                    )}
                  </b>
                </Link>
              </li>
            ))}
        </ul>
        {!statistics.charges.length && (
          <p className={styles.empty}>등록된 결제 일정이 없어요.</p>
        )}
      </details>
      {data.unscheduled.length > 0 && (
        <section className={styles.unscheduled} aria-label="일정 미정 고정비">
          <strong>일정 미정 {data.unscheduled.length}건</strong>
          <p>결제월이 정해지지 않아 월 통계에서 제외했어요.</p>
          <ul>
            {data.unscheduled.map((item) => (
              <li key={item.id}>
                <Link href={`/fixed-costs/${item.id}`}>
                  {item.name}
                  <span>{won(item.expectedAmount)} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
