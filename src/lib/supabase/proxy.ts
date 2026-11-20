import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieOptions } from "./cookie-options";

function redirectWithSession(request: NextRequest, response: NextResponse, pathname: string) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  const redirect = NextResponse.redirect(redirectUrl);
  response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const refreshedCookies = new Map<string, Parameters<SetAllCookies>[0][number]>();
  const refreshHeaders = new Headers();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers = {}) {
        cookiesToSet.forEach((cookie) => {
          request.cookies.set(cookie.name, cookie.value);
          refreshedCookies.set(cookie.name, cookie);
        });
        Object.entries(headers).forEach(([name, value]) => refreshHeaders.set(name, value));
        response = NextResponse.next({ request });
        refreshedCookies.forEach(({ name, value, options }) => {
          response.cookies.set({ ...options, name, value });
        });
        refreshHeaders.forEach((value, name) => response.headers.set(name, value));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/acesso-inicial") ||
    path.startsWith("/acompanhar") ||
    path === "/vendedor" || path.startsWith("/vendedor/");

  if (!data.user && !isPublic) {
    return redirectWithSession(request, response, "/login");
  }

  if (data.user && (path === "/login" || path === "/acesso-inicial")) {
    return redirectWithSession(request, response, "/dashboard");
  }

  return response;
}
