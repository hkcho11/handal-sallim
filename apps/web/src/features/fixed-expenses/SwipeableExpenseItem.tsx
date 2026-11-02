"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import Link from "@/shared/ui/AppLink";
import type { FixedExpense } from "./api";
import TrashIcon from "./TrashIcon";
import styles from "./fixed-expenses.module.css";

export default function SwipeableExpenseItem({
  expense,
  revealed,
  onReveal,
  onDelete,
  children,
}: {
  expense: FixedExpense;
  revealed: boolean;
  onReveal: (open: boolean) => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const gesture = useRef<{
    x: number;
    y: number;
    offset: number;
    horizontal: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const tapStart = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<number | null>(null);

  function start(event: PointerEvent<HTMLDivElement>) {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      (event.target as Element).closest("button")
    )
      return;
    suppressClick.current = false;
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      offset: revealed ? -80 : 0,
      horizontal: false,
    };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.horizontal) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null;
        return;
      }
      if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
      current.horizontal = true;
      if (event.pointerType === "mouse")
        event.currentTarget.setPointerCapture(event.pointerId);
    }
    suppressClick.current = true;
    setDragOffset(Math.max(-80, Math.min(0, current.offset + dx)));
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (current?.horizontal)
      onReveal(
        Math.max(-80, Math.min(0, current.offset + event.clientX - current.x)) <
          -36,
      );
    gesture.current = null;
    setDragOffset(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div
      className={styles.swipeItem}
      data-revealed={revealed}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => {
        gesture.current = null;
        setDragOffset(null);
      }}
    >
      <button
        ref={deleteRef}
        type="button"
        className={styles.swipeDelete}
        aria-label={`${expense.subcategoryName ?? expense.name} 삭제`}
        aria-hidden={!revealed}
        tabIndex={revealed ? 0 : -1}
        onTouchStart={(event) => {
          const touch = event.touches.length === 1 ? event.touches[0] : null;
          tapStart.current = touch
            ? { x: touch.clientX, y: touch.clientY }
            : null;
        }}
        onTouchCancel={() => {
          tapStart.current = null;
        }}
        onTouchEnd={(event) => {
          const start = tapStart.current;
          const touch = event.changedTouches[0];
          tapStart.current = null;
          if (
            !start ||
            !touch ||
            Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10
          )
            return;
          event.preventDefault();
          deleteRef.current?.focus({ preventScroll: true });
          onDelete();
        }}
        onClick={onDelete}
      >
        <TrashIcon />
        <span>삭제</span>
      </button>
      <Link
        href={`/fixed-costs/${expense.id}`}
        className={`${styles.expenseLink} ${styles.swipeCard}`}
        draggable={false}
        style={{
          transform: `translateX(${dragOffset ?? (revealed ? -80 : 0)}px)`,
          transition: dragOffset === null ? undefined : "none",
        }}
        onClick={(event) => {
          if (suppressClick.current || revealed) {
            event.preventDefault();
            suppressClick.current = false;
            if (revealed) onReveal(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onReveal(true);
            requestAnimationFrame(() => deleteRef.current?.focus());
          } else if (event.key === "ArrowRight" || event.key === "Escape") {
            event.preventDefault();
            onReveal(false);
          }
        }}
      >
        {children}
      </Link>
    </div>
  );
}
