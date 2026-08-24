import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/", disallow: "/admin" }, sitemap: "https://youth-policy-data-hub.hayahoyeho.chatgpt.site/sitemap.xml" }; }

