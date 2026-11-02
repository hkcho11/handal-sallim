import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import BottomNavigation from "@/shared/ui/BottomNavigation";
import { Suspense } from "react";
import ScrollRestoration from "@/shared/ui/ScrollRestoration";
import { FixedExpenseListFiltersProvider } from "@/features/fixed-expenses/FixedExpenseListFilters";
import { HomeViewStateProvider } from "@/features/home/HomeViewState";

import AuthBoundary from "@/features/auth/AuthBoundary";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-app",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "한달살림",
  description: "반복 생활비 관리",
  applicationName: "한달살림",
  appleWebApp: {
    capable: true,
    title: "한달살림",
    statusBarStyle: "default",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f6fa",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <AuthBoundary>
          <HomeViewStateProvider>
            <FixedExpenseListFiltersProvider>
              <Suspense fallback={null}>
                <ScrollRestoration />
              </Suspense>
              <div className="app-content">{children}</div>
              <BottomNavigation />
            </FixedExpenseListFiltersProvider>
          </HomeViewStateProvider>
        </AuthBoundary>
      </body>
    </html>
  );
}
