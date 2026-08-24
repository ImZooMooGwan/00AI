import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://youth-policy-data-hub.hayahoyeho.chatgpt.site"),
  title: {
    default: "청년정책데이터허브 Y-HUB",
    template: "%s | Y-HUB",
  },
  description: "AI로 시각화한 대한민국 청년정책. 정책의 현재와 변화를 출처·기준일·검증상태와 함께 탐색합니다.",
  keywords: ["청년정책", "공공데이터", "정책변화", "Y-HUB", "청년정책데이터허브"],
  openGraph: {
    title: "청년정책데이터허브 Y-HUB",
    description: "정책의 발표가 아니라, 정책의 변화를 기록합니다.",
    type: "website",
    locale: "ko_KR",
    siteName: "Y-HUB",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "청년정책데이터허브 Y-HUB" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "청년정책데이터허브 Y-HUB",
    description: "대한민국 청년정책의 현재와 변화를 한곳에서",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
