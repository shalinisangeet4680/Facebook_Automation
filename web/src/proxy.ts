import { NextResponse, type NextRequest } from "next/server";

const SESSION_HINT = "has_session";

function safeNext(value: string | null): string | null {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const signedIn = request.cookies.get(SESSION_HINT)?.value === "1";
  const onLogin = pathname === "/login";

  if (onLogin) {
    if (signedIn && !searchParams.has("expired")) {
      return NextResponse.redirect(
        new URL(safeNext(searchParams.get("next")) ?? "/setup", request.url),
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
    "/((?!api|mcp|\\.well-known|oauth/token|oauth/register|oauth/revoke|_next/static|_next/image|kit|favicon.ico|.*\\.[a-z0-9]+$).*)",
  ],
};
