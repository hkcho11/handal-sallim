"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./bottom-navigation.module.css";

export default function BottomNavigation() {
  const pathname = usePathname();
  const isFixedCosts =
    pathname === "/fixed-costs" || pathname === "/entries/new";

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
          href="/fixed-costs"
          aria-current={isFixedCosts ? "page" : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="5" width="16" height="16" rx="2" />
            <path d="M8 3v4m8-4v4M4 11h16m-12 4h3m2 0h3m-8 3h3" />
          </svg>
          고정비
        </Link>
      </div>
    </nav>
  );
}
