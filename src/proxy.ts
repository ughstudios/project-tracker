import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CORS_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD";
const CORS_ALLOW_HEADERS =
  "Content-Type, Authorization, X-Requested-With, Next-Auth-CSRF-Token, Next-Auth-Callback-Url, x-blob-relay-session";

/** Set `CORS_ALLOWED_ORIGINS` (comma-separated) to override auto-detection in production. */
function allowedOrigins(): string[] {
  const fromEnv = process.env.CORS_ALLOWED_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv?.length) return [...new Set(fromEnv)];

  if (process.env.NODE_ENV !== "production") {
    return [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
    ];
  }

  const out = new Set<string>();
  const primary = (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL)?.replace(/\/$/, "");
  if (primary) out.add(primary);
  const vercel = process.env.VERCEL_URL;
  if (vercel) out.add(`https://${vercel}`);
  return [...out];
}

export function proxy(request: NextRequest) {
  const origins = allowedOrigins();
  const origin = request.headers.get("origin");
  const isAllowedOrigin = Boolean(origin && origins.includes(origin));

  if (request.method === "OPTIONS") {
    const headers = new Headers();
    headers.set(
      "Access-Control-Allow-Origin",
      isAllowedOrigin && origin ? origin : "null",
    );
    headers.set("Access-Control-Allow-Methods", CORS_METHODS);
    headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
    headers.set("Access-Control-Max-Age", "86400");
    if (isAllowedOrigin) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  if (isAllowedOrigin && origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  response.headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  response.headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
