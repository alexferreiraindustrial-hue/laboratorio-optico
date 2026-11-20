import type { CookieOptionsWithName } from "@supabase/ssr";

// Isolate LAB tokens from legacy cookies and other applications on the same site.
export const LAB_SESSION_COOKIE = "oticahub-lab-auth-v2";

export function sessionCookieOptions(): CookieOptionsWithName {
  const secure = process.env.NODE_ENV === "production";
  return {
    name: LAB_SESSION_COOKIE,
    path: "/",
    secure,
    sameSite: secure ? "none" : "lax",
    // Keep the embedded session available when third-party cookies are blocked.
    partitioned: secure,
  };
}
