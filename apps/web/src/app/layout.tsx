import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import BottomNavigation from "@/shared/ui/BottomNavigation";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-app",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "한달살림",
  description: "반복 생활비 관리",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <div className="app-content">{children}</div>
        <BottomNavigation />
      </body>
    </html>
  );
}
