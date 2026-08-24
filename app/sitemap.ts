import type { MetadataRoute } from "next";
import { policies } from "@/lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = "https://youth-policy-data-hub.hayahoyeho.chatgpt.site";
  const staticRoutes = ["", "/changes", "/policies", "/compare", "/indicators", "/map", "/graph", "/research", "/newsroom", "/verification", "/methodology", "/sources", "/downloads", "/api"];
  return [...staticRoutes.map((path) => ({ url: `${origin}${path}`, lastModified: new Date("2026-08-24"), changeFrequency: path === "/changes" ? "daily" as const : "weekly" as const })), ...policies.map((policy) => ({ url: `${origin}/policy/${policy.slug}`, lastModified: new Date(policy.lastObservedAt), changeFrequency: "weekly" as const }))];
}

