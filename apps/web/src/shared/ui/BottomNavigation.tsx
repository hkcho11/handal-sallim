"use client";

import Link from "@/shared/ui/AppLink";
import { usePathname } from "next/navigation";
import styles from "./bottom-navigation.module.css";

export default function BottomNavigation() {
  const pathname = usePathname();
  if (pathname.startsWith("/auth/")) return null;
  const isFixedCosts =
    pathname === "/fixed-costs" ||
    pathname.startsWith("/fixed-costs/") ||
    pathname === "/entries/new";

  return (
    <nav aria-label="하단 메뉴" className={styles.navigation}>
      <div className={styles.tabs}>
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m3 10 9-7 9 7v10H3Z M9 20v-7h6v7" />
          </svg>
          홈
        </Link>
        <Link
          href="/income"
          aria-current={
            pathname === "/income" || pathname.startsWith("/income/")
              ? "page"
              : undefined
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
          </svg>
          수입
        </Link>
        <Link
          href="/fixed-costs"
          aria-current={isFixedCosts ? "page" : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="5" width="16" height="16" rx="2" />
            <path d="M8 3v4m8-4v4M4 11h16m-12 4h3m2 0h3m-8 3h3" />
          </svg>
          지출
        </Link>
        <Link
          href="/savings"
          aria-current={
            pathname === "/savings" || pathname.startsWith("/savings/")
              ? "page"
              : undefined
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="8" width="16" height="13" rx="3" />
            <path d="M9 12h6M12 3v5m-3-3 3 3 3-3" />
          </svg>
          저축
        </Link>
        <Link
          href="/settings"
          aria-current={
            pathname === "/settings" ||
            pathname.startsWith("/settings/") ||
            pathname === "/payment-methods" ||
            pathname.startsWith("/payment-methods/")
              ? "page"
              : undefined
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m10 3-1 3-3 1-3 4 2 3v4l4 2 3-1 3 1 4-2v-4l2-3-3-4-3-1-1-3Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          설정
        </Link>
      </div>
    </nav>
  );
}
