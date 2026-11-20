import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ token: "own-seller-token", kind: "seller", error: null as string | null, loginOK: true, set: vi.fn(), send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.token ? { value: state.token } : undefined, set: state.set }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./portal", () => ({
  loadPortalIdentity: async () => ({ name: "Ana", kind: state.kind, error: state.error }),
  loginSellerApp: async () => state.loginOK ? { ok: true, token: "private-login-token", kind: "vendedor", name: "Ana" } : { ok: false, message: "Código ou PIN inválidos." },
  sendPortalMessage: state.send,
}));

import { sellerSession, SELLER_COOKIE } from "./seller-session";
import { sellerSignIn, submitSellerSessionMessage } from "./seller-actions";

beforeEach(() => { state.token = "own-seller-token"; state.kind = "seller"; state.error = null; state.loginOK = true; state.set.mockReset(); state.send.mockReset().mockResolvedValue({ ok: true, message: "Enviado" }); });

describe("sessão exclusiva do vendedor", () => {
  it("exige cookie e valida a identidade no servidor", async () => {
    state.token = "";
    await expect(sellerSession()).rejects.toThrow("redirect:/vendedor/login");
    state.token = "own-seller-token";
    expect((await sellerSession()).error).toBeNull();
    state.kind = "store";
    expect((await sellerSession()).error).not.toBeNull();
  });
  it("não aceita acesso revogado mesmo quando o cookie ainda existe", async () => {
    state.error = "Este link foi revogado.";
    expect((await sellerSession()).error).toBe("Este link foi revogado.");
  });
  it("guarda o token em cookie HttpOnly sem retornar credencial para o cliente", async () => {
    const result = await sellerSignIn(new FormData());
    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty("token");
    expect(state.set).toHaveBeenCalledWith(SELLER_COOKIE, "private-login-token", expect.objectContaining({ httpOnly: true, path: "/vendedor" }));
    state.set.mockClear(); state.loginOK = false;
    expect((await sellerSignIn(new FormData())).ok).toBe(false);
    expect(state.set).not.toHaveBeenCalled();
  });
  it("usa a credencial do cookie, nunca o token ou vendedor enviados pelo formulário", async () => {
    const data = new FormData(); data.set("token", "forged-other-token"); data.set("sellerId", "other-seller"); data.set("orderId", "order-a"); data.set("body", "Qual é a previsão?");
    await submitSellerSessionMessage(data);
    expect(state.send).toHaveBeenCalledWith("own-seller-token", "order-a", "Qual é a previsão?");
    state.kind = "store"; state.send.mockClear();
    expect((await submitSellerSessionMessage(data)).ok).toBe(false);
    expect(state.send).not.toHaveBeenCalled();
  });
});
