/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Serve the static 00AI GOV policy command center from both the
    // policy subdomain and the /policy path on the portal domain.
    const isPolicyHost = url.hostname === "policy.00ai.kr";
    const isPolicyPath = url.pathname === "/policy" || url.pathname === "/policy/" || url.pathname.startsWith("/policy/");
    if (isPolicyHost || isPolicyPath) {
      const policyAssetPath = isPolicyHost
        ? (url.pathname === "/" ? "/policy/index.html" : `/policy${url.pathname}`)
        : (url.pathname === "/policy" || url.pathname === "/policy/" ? "/policy/index.html" : url.pathname);
      const assetUrl = new URL(request.url);
      assetUrl.pathname = policyAssetPath;
      const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
      if (assetResponse.status !== 404) return assetResponse;
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
