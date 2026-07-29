import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "모두의 학폭비서 | 학교 업무 지원 도구",
  description: "학교폭력 담당교사의 업무를 돕는 비식별 기반 AI 업무지원 도구",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
