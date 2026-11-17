import type { CookieOptions } from "@supabase/ssr";

export function sessionCookieOptions(): CookieOptions {
  const secure = process.env.NODE_ENV === "production";
  return {
    path: "/",
    secure,
    sameSite: secure ? "none" : "lax",
    // Keep the embedded session available when third-party cookies are blocked.
    partitioned: secure,
  };
}
