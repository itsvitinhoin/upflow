import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { TEST_AUTH_COOKIE } from "@/lib/test-auth";

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: { headers: req.headers } });
  const cookieMutations: Array<{ name: string; value: string; options?: Parameters<typeof response.cookies.set>[0] }> = [];

  // Dev/CI-only login bypass — gated by NODE_ENV (Edge runtime can't reliably
  // see arbitrary env vars during dev, so we only check the cookie shape
  // here; `getAuthResult()` does the actual HMAC verification in the Node
  // runtime, which is the source of truth for whether the bypass is on).
  const rawTestCookie = req.cookies.get(TEST_AUTH_COOKIE)?.value;
  const testCookieShapeOk =
    process.env.NODE_ENV !== "production" &&
    Boolean(rawTestCookie) &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(rawTestCookie!);
  let user: { email?: string | null } | null = testCookieShapeOk
    ? { email: "pending-server-verify" }
    : null;

  if (!user) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: Parameters<typeof response.cookies.set>[0]) {
            cookieMutations.push({ name, value, options });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: Parameters<typeof response.cookies.set>[0]) {
            cookieMutations.push({ name, value: "", options });
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );

    const got = await supabase.auth.getUser();
    user = got.data.user;
  }

  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api/");
  const isStatic =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".");

  if (isStatic || isApiRoute) return response;

  if (!user && !isLoginPage) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Only redirect away from /login when we have a *real* Supabase session.
  // The test-cookie path here is shape-only; if it's stale or forged, the
  // Node-runtime auth check would bounce us back here and we'd loop. So
  // when the bypass path is in play, leave the login page reachable.
  if (user && isLoginPage && !testCookieShapeOk) {
    const homeUrl = req.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  for (const cookie of cookieMutations) {
    response.cookies.set({ name: cookie.name, value: cookie.value, ...(cookie.options ?? {}) });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
