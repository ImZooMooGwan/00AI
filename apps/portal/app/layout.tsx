import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "00AI — 공공을 위한 AI", description: "정책에서 서비스까지, 아이디어에서 배포까지. 공공 AI 플랫폼 00AI.", other: { "codex-preview": "development" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
