import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: { headers: req.headers } });
  const cookieMutations: Array<{ name: string; value: string; options?: Parameters<typeof response.cookies.set>[0] }> = [];

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  if (user && isLoginPage) {
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
