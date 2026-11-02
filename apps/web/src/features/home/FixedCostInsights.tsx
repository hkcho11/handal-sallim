"use client";

import { useHomeViewState } from "./HomeViewState";
import Link from "@/shared/ui/AppLink";
import DisclosureChevron from "../../shared/ui/DisclosureChevron";
import {
  categoryStatistics,
  monthlyChanges,
  paymentStatistics,
  won,
  type FixedCostDashboard,
  type FixedCostCharge,
} from "./fixedCostStatistics";
import styles from "./fixed-cost-dashboard.module.css";
import { chargeTiming } from "./chargeTiming";
const unknown = "unclassified";
const compactWon = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const signedWon = (amount: number) =>
  `${amount > 0 ? "+" : amount < 0 ? "−" : ""}${won(Math.abs(amount))}`;
function changeLabel(
  change: number | null,
  percentage: number | null,
  showSign = true,
) {
  if (change === null) return "비교 기록 없음";
  const amount = showSign ? signedWon(change) : won(Math.abs(change));
  const rate =
    percentage === null
      ? "—"
      : showSign
        ? `${percentage > 0 ? "+" : ""}${percentage.toFixed(1)}%`
        : `${Math.abs(percentage).toFixed(1)}%`;
  return `${amount} (${rate})`;
}
function PaymentChange({
  change,
  percentage,
}: {
  change: number | null;
  percentage: number | null;
}) {
  return (
    <span
      className={styles.change}
      data-direction={
        change === null || change === 0
          ? "neutral"
          : change > 0
            ? "increase"
            : "decrease"
      }
    >
      {change !== null && change !== 0 && (
        <>
          <svg
            className={styles.changeArrow}
            viewBox="0 0 12 12"
            aria-hidden="true"
          >
            <path d={change > 0 ? "M6 2 11 10H1Z" : "M1 2H11L6 10Z"} />
          </svg>
          <span className={styles.srOnly}>
            {change > 0 ? "증가 " : "감소 "}
          </span>
        </>
      )}
      <b>{changeLabel(change, percentage, false)}</b>
    </span>
  );
}
function categoryColor(data: FixedCostDashboard, id: string | null) {
  const ids = [
    ...new Set([
      ...data.classifications.map((item) => item.categoryId),
      ...data.charges.flatMap((item) =>
        item.categoryId === null ? [] : [item.categoryId],
      ),
    ]),
  ].sort();
  const index = id === null ? ids.length : ids.indexOf(id);
  return `hsl(${(Math.max(0, index) * 137.508 + 225) % 360} 58% 55%)`;
}
function chargeLabel(charge: FixedCostCharge) {
  return charge.status === "완료"
    ? `${won(charge.actualAmount ?? 0)} · 완료`
    : charge.status;
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
  const [parent, setParent] = useHomeViewState(
    `${data.month}.parent`,
    first?.categoryId ?? unknown,
  );
  const [sub, setSub] = useHomeViewState(
    `${data.month}.sub`,
    first?.subcategoryId ?? unknown,
  );
  const [trendMonth, setTrendMonth] = useHomeViewState(
    `${data.month}.trendMonth`,
    data.month,
  );
  const [expandedCategory, setExpandedCategory] = useHomeViewState<
    string | null
  >(`${data.month}.expandedCategory`, null);
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
    parents.push({ id: unknown, name: "상위 분류 미지정" });
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
    subcategories.push({ id: unknown, name: "세부 분류 미지정" });
  const selectedSub = subcategories.some((c) => c.id === sub)
    ? sub
    : subcategories[0].id;
  const changes = monthlyChanges(
    data,
    selectedSub === unknown ? null : selectedSub,
    parent === unknown ? null : parent,
  );
  const selectedName =
    subcategories.find((c) => c.id === selectedSub)?.name ?? "세부 분류 미지정";
  const selectedPoint =
    changes.find((point) => point.month === trendMonth) ??
    changes[changes.length - 1];
  const methods = paymentStatistics(data);
  const total = statistics.actual;
  const trendMaximum = Math.max(
    1,
    ...changes.map((point) => point.amount ?? 0),
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
      <section className={styles.panel} aria-label="상위 분류별 지출 통계">
        <div className={styles.total}>
          <span>총 결제액</span>
          <strong>{won(total)}</strong>
        </div>
        {statistics.categories.length ? (
          <div className={styles.categoryList}>
            <div className={styles.distributionBar} aria-hidden="true">
              {statistics.categories.map((category) => (
                <span
                  key={category.id ?? unknown}
                  style={{
                    width: `${total > 0 ? (category.actual / total) * 100 : 0}%`,
                    backgroundColor: categoryColor(data, category.id),
                  }}
                />
              ))}
            </div>
            <ul
              className={styles.distributionLegend}
              aria-label="분류별 지출 비중"
            >
              {statistics.categories.map((category) => (
                <li key={category.id ?? unknown}>
                  <span
                    className={styles.legendDot}
                    style={{
                      backgroundColor: categoryColor(data, category.id),
                    }}
                    aria-hidden="true"
                  />
                  {category.name}{" "}
                  {total > 0
                    ? `${((category.actual / total) * 100).toFixed(1)}%`
                    : "—"}
                </li>
              ))}
            </ul>
            {statistics.categories.map((category) => {
              const key = category.id ?? unknown;
              return (
                <div
                  key={key}
                  className={styles.category}
                  data-disclosure
                  data-expanded={expandedCategory === key}
                >
                  <button
                    type="button"
                    className={styles.categoryButton}
                    data-disclosure-trigger
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
                        <b>{won(category.actual)}</b>
                        <small>
                          전월 대비{" "}
                          <PaymentChange
                            change={category.change}
                            percentage={category.percentage}
                          />
                        </small>
                      </span>
                    </span>
                    <span className={styles.categoryChevron} aria-hidden="true">
                      <DisclosureChevron />
                    </span>
                  </button>
                  <div
                    id={`category-${key}`}
                    className={styles.categoryDetails}
                    data-expanded={expandedCategory === key}
                    aria-hidden={expandedCategory !== key}
                    inert={expandedCategory !== key}
                  >
                    <div className={styles.categoryDetailsInner}>
                      <ul className={styles.entryList}>
                        {category.items.map((charge) => (
                          <li key={charge.id}>
                            <Link
                              href={`/fixed-costs/${charge.recurringExpenseId}?charge=${encodeURIComponent(charge.id)}`}
                            >
                              <span>
                                {charge.name}
                                <small>
                                  {charge.subcategoryName ?? "세부 분류 미지정"}
                                </small>
                                <small
                                  className={
                                    charge.status === "지연"
                                      ? styles.overdueDate
                                      : undefined
                                  }
                                >
                                  {chargeTiming(charge, data.asOf)}
                                </small>
                              </span>
                              <b>{chargeLabel(charge)}</b>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty}>이 달에 결제 완료한 내역이 없어요.</p>
        )}
      </section>
      <section className={styles.panel} aria-labelledby="trend-title">
        <div className={styles.sectionHeader}>
          <h2 id="trend-title">세부 분류별 월별 변화</h2>
          <span className={styles.note}>최근 6개월</span>
        </div>
        <div className={styles.selectors}>
          <label>
            상위 분류
            <select
              aria-label="상위 분류"
              data-align="center"
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
            세부 분류
            <select
              aria-label="세부 분류"
              data-align="center"
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
            <PaymentChange
              change={selectedPoint.change}
              percentage={selectedPoint.percentage}
            />
          </p>
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
              aria-label={`${Number(point.month.slice(0, 4))}년 ${Number(point.month.slice(5))}월, ${point.amount === null ? "기록 없음" : won(point.amount)}, 전월 대비 ${changeLabel(point.change, point.percentage)}`}
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
              <span>완료 건수</span>
            </div>
            {methods.map((method) => (
              <div
                key={method.id ?? "unassigned"}
                className={styles.paymentRow}
              >
                <strong>{method.name}</strong>
                <span>{won(method.actual)}</span>
                <span>{method.completedCount}건</span>
              </div>
            ))}
          </>
        ) : (
          <p className={styles.empty}>이 달의 결제수단 내역이 없어요.</p>
        )}
        <p className={styles.note}>
          결제 완료 내역을 실제 결제수단 기준으로 집계합니다.
        </p>
      </section>
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
