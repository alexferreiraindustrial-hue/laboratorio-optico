import { afterEach, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { LAB_SESSION_COOKIE, sessionCookieOptions } from "./cookie-options";

afterEach(() => vi.unstubAllEnvs());

describe("isolamento da sessão do laboratório", () => {
  it("renova um token expirado e usa o cookie novo na próxima ação sem repetir o refresh", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", created_at: "2026-01-01T00:00:00Z" };
    const jar = new Map<string, string>();
    let tokenRequests = 0;
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("/user")) return new Response(JSON.stringify(user), { headers: { "Content-Type": "application/json" } });
      tokenRequests++;
      const expired = tokenRequests === 1;
      const exp = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
      const access = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp, aud: "authenticated" })}.test-signature`;
      return new Response(JSON.stringify({ access_token: access, refresh_token: expired ? "test-old-refresh" : "test-new-refresh", expires_in: expired ? -60 : 3600, expires_at: exp, token_type: "bearer", user }), { headers: { "Content-Type": "application/json" } });
    });
    const client = () => createServerClient("https://example.supabase.co", "public-test-key", {
      cookieOptions: sessionCookieOptions(), global: { fetch: fetcher },
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => cookies.forEach(({ name, value }) => { if (value) jar.set(name, value); else jar.delete(name); }),
      },
    });
    expect((await client().auth.signInWithPassword({ email: "test@example.invalid", password: "fake-test-password" })).error).toBeNull();
    const expiredCookie = jar.get(LAB_SESSION_COOKIE);
    expect((await client().auth.getUser()).data.user?.id).toBe(user.id);
    expect(tokenRequests).toBe(2);
    expect(jar.get(LAB_SESSION_COOKIE)).not.toBe(expiredCookie);
    expect((await client().auth.getUser()).data.user?.id).toBe(user.id);
    expect(tokenRequests).toBe(2);
  });
  it("usa uma sessão nova no cliente de servidor seguinte, ignorando cookies antigos", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", created_at: "2026-01-01T00:00:00Z" };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const access = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp, aud: "authenticated" })}.test-signature`;
    const jar = new Map([["sb-example-auth-token", "invalid-legacy-session"]]);
    const fetcher = vi.fn(async (url: string | URL | Request) => new Response(JSON.stringify(String(url).includes("/user") ? user : {
      access_token: access, refresh_token: "test-fresh-refresh", expires_in: 3600, expires_at: exp, token_type: "bearer", user,
    }), { headers: { "Content-Type": "application/json" } }));
    const client = () => createServerClient("https://example.supabase.co", "public-test-key", {
      cookieOptions: sessionCookieOptions(),
      global: { fetch: fetcher },
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => cookies.forEach(({ name, value }) => { if (value) jar.set(name, value); else jar.delete(name); }),
      },
    });
    const login = await client().auth.signInWithPassword({ email: "test@example.invalid", password: "fake-test-password" });
    expect(login.error).toBeNull();
    expect(jar.has(LAB_SESSION_COOKIE)).toBe(true);
    expect(jar.get("sb-example-auth-token")).toBe("invalid-legacy-session");
    const request = await client().auth.getUser();
    expect(request.error).toBeNull();
    expect(request.data.user?.id).toBe(user.id);
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/token"))).toHaveLength(1);
  });
});
