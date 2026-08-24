import { NextRequest, NextResponse } from "next/server";
import domainMap from "./app/data/domain-map.json";

type DomainEntry = {
  target: string;
  mode: "proxy" | "redirect" | "drop";
};

const ROUTES = domainMap as Record<string, DomainEntry>;
const PORTAL_HOSTS = new Set(["00ai.kr", "www.00ai.kr", "harness.00ai.kr"]);

function joinPath(basePath: string, requestPath: string) {
  const base = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const path = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
  return `${base}${path}` || "/";
}

export default function proxy(request: NextRequest) {
  const hostname = (request.headers.get("host") || "")
    .split(":")[0]
    .trim()
    .toLowerCase();

  if (!hostname || PORTAL_HOSTS.has(hostname)) return NextResponse.next();

  const entry = ROUTES[hostname];
  if (!entry) return NextResponse.next();

  if (entry.mode === "drop") {
    if (request.nextUrl.pathname.startsWith("/api/drop-public/")) {
      return NextResponse.next();
    }
    if (request.nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL("https://00ai.kr/#deploy"));
    }
    const internal = request.nextUrl.clone();
    internal.pathname = `/api/drop-public${request.nextUrl.pathname}`;
    return NextResponse.rewrite(internal);
  }

  const target = new URL(entry.target);
  if (entry.mode === "redirect") {
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target);
  }

  target.pathname = joinPath(target.pathname, request.nextUrl.pathname);
  target.search = request.nextUrl.search;
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: "/:path*",
};
