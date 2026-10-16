import { NextResponse, type NextRequest } from "next/server";

import { isSharedPath, productForHost, productForPath } from "@/lib/products";

const SESSION_HINT = "has_session";

function safeNext(value: string | null): string | null {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function rootUrl(): URL | null {
  const raw = process.env.ROOT_URL;
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const signedIn = request.cookies.get(SESSION_HINT)?.value === "1";
  const product = productForHost(request.headers.get("host"));
  const home = product?.home ?? "/setup";

  if (product) {
    if (pathname === "/") return NextResponse.redirect(new URL(home, request.url));
    const owner = productForPath(pathname);
    const root = rootUrl();
    if (owner && owner.id !== product.id && root && !isSharedPath(pathname)) {
      return NextResponse.redirect(new URL(`${pathname}${search}`, root));
    }
  }

  if (pathname === "/login") {
    if (signedIn && !searchParams.has("expired")) {
      return NextResponse.redirect(
        new URL(safeNext(searchParams.get("next")) ?? home, request.url),
      );
    }
    return NextResponse.next();
  }

  if (!signedIn) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|mcp|media|\\.well-known|oauth/token|oauth/register|oauth/revoke|_next/static|_next/image|kit|favicon.ico|.*\\.[a-z0-9]+$).*)",
  ],
};
