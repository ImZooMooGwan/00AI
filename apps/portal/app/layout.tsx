import type { Metadata } from "next";
import "./globals.css";
import "./font-face.css";
export const metadata: Metadata = { title: "00AI — 행정 공공업무 도구", description: "정책 검토, 행정문서 작성, 공공데이터 탐색과 업무 관리를 지원하는 00AI 공공업무 도구 모음입니다." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
