import type { Metadata } from "next";
import "./globals.css";
import "./font-face.css";
export const metadata: Metadata = { title: "00AI — AI는, 모두의 것.", description: "누구나 쓰고, 함께 만들고, 지역을 바꾸는 공공 AI. 대전시 청년 AI 보편복지 모델과 정책·행정·청년정책 서비스를 만나보세요.", other: { "codex-preview": "development" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
