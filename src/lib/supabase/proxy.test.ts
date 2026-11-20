import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { LAB_SESSION_COOKIE, sessionCookieOptions } from "./cookie-options";
import { updateSession } from "./proxy";

const session = vi.hoisted(() => ({ user: null as null | { id: string }, refresh: false, secondWrite: false }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, options) => ({
    auth: {
      getUser: async () => {
        if (session.refresh) options.cookies.setAll([
          { name: "session-test", value: session.user ? "renewed" : "", options: { ...options.cookieOptions, maxAge: session.user ? 3600 : 0 } },
        ], { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", Expires: "0", Pragma: "no-cache" });
        if (session.secondWrite) options.cookies.setAll([
          { name: "session-test.1", value: "second-chunk", options: options.cookieOptions },
        ], {});
        return { data: { user: session.user } };
      },
    },
  })),
}));

afterEach(() => { vi.unstubAllEnvs(); session.user = null; session.refresh = false; session.secondWrite = false; });

describe("sessão do LAB incorporado ao CRM", () => {
  it("usa cookies particionados HTTPS em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions()).toMatchObject({ path: "/", sameSite: "none", secure: true, partitioned: true });
    expect(sessionCookieOptions().name).toBe(LAB_SESSION_COOKIE);
  });
  it("mantém o desenvolvimento HTTP funcionando", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieOptions()).toMatchObject({ sameSite: "lax", secure: false, partitioned: false });
  });
  it.each(["/login", "/acesso-inicial", "/dashboard", "/ordens"])("conserva a renovação da sessão em %s", async path => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
    session.user = { id: "test-user" }; session.refresh = true;
    const response = await updateSession(new NextRequest(`https://lab.example.org${path}`));
    expect(response.cookies.get("session-test")?.value).toBe("renewed");
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=none");
    expect(cookie).toContain("Partitioned");
    if (path === "/login" || path === "/acesso-inicial") expect(response.headers.get("location")).toBe("https://lab.example.org/dashboard");
    else expect(response.headers.get("location")).toBeNull();
  });
  it("continua bloqueando usuário sem sessão e preserva a remoção do cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
    session.refresh = true;
    const response = await updateSession(new NextRequest("https://lab.example.org/dashboard"));
    expect(response.headers.get("location")).toBe("https://lab.example.org/login");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it.each(["/login", "/laboratorio/rapido"])("mantém todos os cookies e cabeçalhos em %s após mais de uma escrita", async path => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
    session.user = { id: "test-user" }; session.refresh = true; session.secondWrite = true;
    const response = await updateSession(new NextRequest(`https://lab.example.org${path}`, { method: "POST" }));
    expect(response.cookies.get("session-test")?.value).toBe("renewed");
    expect(response.cookies.get("session-test.1")?.value).toBe("second-chunk");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
  });
});
