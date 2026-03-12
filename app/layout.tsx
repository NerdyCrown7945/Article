import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Article Summarizer",
  description: "웹 기사 요약 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
