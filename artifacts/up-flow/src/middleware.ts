import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { TEST_AUTH_COOKIE } from "@/lib/test-auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isStatic =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".");

  if (isStatic || isApiRoute) {
    return NextResponse.next({ request: { headers: req.headers } });
  }

  let response = NextResponse.next({ request: { headers: req.headers } });
  const cookieMutations: Array<{ name: string; value: string; options?: CookieOptions }> = [];

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
          getAll() {
            return req.cookies.getAll().map(({ name, value }) => ({ name, value }));
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              const opts: CookieOptions = options ?? {};
              cookieMutations.push({ name, value, options: opts });
              response.cookies.set({ name, value, ...opts });
            }
          },
        },
      }
    );

    try {
      const got = await supabase.auth.getUser();
      user = got.data.user;
    } catch {
      user = null;
    }
  }

  const isLoginPage = pathname === "/login";
  // Public, unauthenticated pages: login + the password-recovery flow +
  // the invite landing page (lets a logged-out invitee click the email
  // link and sign up before joining).
  const isPublicAuthPage =
    isLoginPage ||
    pathname === "/auth/forgot" ||
    pathname === "/auth/reset" ||
    pathname.startsWith("/invite/");
  if (!user && !isPublicAuthPage) {
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
    const opts: CookieOptions = cookie.options ?? {};
    response.cookies.set({ name: cookie.name, value: cookie.value, ...opts });
  }

  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
