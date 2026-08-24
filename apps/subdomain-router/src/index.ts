type Route = {
  target: string;
  mode: "proxy" | "redirect" | "drop";
};

const ROUTES: Record<string, Route> = {
  "policy.00ai.kr": { target: "https://public-ai-gov.hayahoyeho.chatgpt.site", mode: "proxy" },
  "public-ai-gov.00ai.kr": { target: "https://public-ai-gov.hayahoyeho.chatgpt.site", mode: "proxy" },
  "yhub.00ai.kr": { target: "https://youth-policy-data-hub.hayahoyeho.chatgpt.site", mode: "proxy" },
  "youth-policy-data-hub.00ai.kr": { target: "https://youth-policy-data-hub.hayahoyeho.chatgpt.site", mode: "proxy" },
  "oneul-daejeon.00ai.kr": { target: "https://oneul-daejeon.hayahoyeho.chatgpt.site", mode: "proxy" },
  "great-succession-era.00ai.kr": { target: "https://great-succession-era.hayahoyeho.chatgpt.site", mode: "proxy" },
  "clan-family-registry.00ai.kr": { target: "https://clan-family-registry.hayahoyeho.chatgpt.site", mode: "proxy" },
  "coliving-fit-lab.00ai.kr": { target: "https://coliving-fit-lab.hayahoyeho.chatgpt.site", mode: "proxy" },
  "telegrim-messenger-0728.00ai.kr": { target: "https://telegrim-messenger-0728.hayahoyeho.chatgpt.site", mode: "proxy" },
  "panel-review-lab.00ai.kr": { target: "https://panel-review-lab.hayahoyeho.chatgpt.site", mode: "proxy" },
  "careplan-family-action.00ai.kr": { target: "https://careplan-family-action.hayahoyeho.chatgpt.site", mode: "proxy" },
  "fanline-fandom-network.00ai.kr": { target: "https://fanline-fandom-network.hayahoyeho.chatgpt.site", mode: "proxy" },
  "dukjil-workstation.00ai.kr": { target: "https://dukjil-workstation.hayahoyeho.chatgpt.site", mode: "proxy" },
  "deok-calendar.00ai.kr": { target: "https://deok-calendar.hayahoyeho.chatgpt.site", mode: "proxy" },
  "ilgito-duel-20260720.00ai.kr": { target: "https://ilgito-duel-20260720.hayahoyeho.chatgpt.site", mode: "proxy" },
  "daejeon-after-hours-2d.00ai.kr": { target: "https://daejeon-after-hours-2d.hayahoyeho.chatgpt.site", mode: "proxy" },
  "after-hours-dialogue.00ai.kr": { target: "https://after-hours-dialogue.hayahoyeho.chatgpt.site", mode: "proxy" },
  "drop.00ai.kr": { target: "drop", mode: "drop" },
};

const DROP_SERVE_URL =
  "https://jbxmjsezaaqarheyjjte.supabase.co/functions/v1/zeroai-drop-serve";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpieG1qc2V6YWFxYXJoZXlqanRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Nzc2MzUsImV4cCI6MjEwMTM1MzYzNX0.ZEoudIFSGGFSVhXpNc4Vf_Obv884mQQLS_9qhaWzxHI";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

function withSecurity(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  headers.set("X-00AI-Router", "subdomain-router-v1");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function buildTarget(base: string, incoming: URL) {
  const target = new URL(base);
  const prefix = target.pathname === "/" ? "" : target.pathname.replace(/\/$/, "");
  target.pathname = `${prefix}${incoming.pathname}` || "/";
  target.search = incoming.search;
  return target;
}

async function proxyExternal(request: Request, route: Route, incoming: URL) {
  const target = buildTarget(route.target, incoming);
  const upstreamRequest = new Request(target, request);
  const upstreamHeaders = new Headers(upstreamRequest.headers);
  upstreamHeaders.set("Host", target.hostname);
  upstreamHeaders.set("X-Forwarded-Host", incoming.hostname);
  upstreamHeaders.set("X-00AI-Original-Host", incoming.hostname);

  const response = await fetch(new Request(upstreamRequest, { headers: upstreamHeaders }), {
    redirect: "manual",
  });

  const headers = new Headers(response.headers);
  headers.delete("set-cookie");

  const location = headers.get("Location");
  if (location) {
    try {
      const redirected = new URL(location, target);
      if (redirected.origin === target.origin) {
        redirected.protocol = incoming.protocol;
        redirected.host = incoming.host;
        headers.set("Location", redirected.toString());
      }
    } catch {
      // Keep malformed/relative Location unchanged.
    }
  }

  headers.set("X-00AI-Upstream", target.hostname);
  return withSecurity(
    new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  );
}

async function serveDrop(request: Request, incoming: URL) {
  const parts = incoming.pathname.split("/").filter(Boolean);
  if (!parts.length) {
    return Response.redirect("https://00ai.kr/#deploy", 302);
  }

  const encodedPath = parts.map((part) => encodeURIComponent(decodeURIComponent(part))).join("/");
  const target = new URL(`${DROP_SERVE_URL}/${encodedPath}`);
  target.search = incoming.search;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
  headers.set("apikey", SUPABASE_ANON_KEY);
  if (request.headers.get("Range")) headers.set("Range", request.headers.get("Range")!);

  const response = await fetch(target, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers,
    redirect: "manual",
  });

  const outgoing = new Headers(response.headers);
  outgoing.delete("set-cookie");
  outgoing.set("X-00AI-Upstream", "DROP");
  return withSecurity(
    new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outgoing,
    }),
  );
}

export default {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url);
    const hostname = incoming.hostname.toLowerCase();
    const route = ROUTES[hostname];

    if (!route) return new Response("Not Found", { status: 404 });
    if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(request.method)) {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (route.mode === "drop") return serveDrop(request, incoming);
    if (route.mode === "redirect") {
      const target = buildTarget(route.target, incoming);
      return Response.redirect(target.toString(), 302);
    }
    return proxyExternal(request, route, incoming);
  },
} satisfies ExportedHandler;
