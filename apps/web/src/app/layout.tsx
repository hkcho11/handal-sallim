import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한달살림",
  description: "반복 생활비 관리",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
