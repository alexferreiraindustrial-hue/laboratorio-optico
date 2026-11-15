import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "./auth";

describe("mensagens de acesso", () => {
  it("distingue credenciais inválidas de falha de conexão", () => {
    expect(loginErrorMessage({ code: "invalid_credentials", status: 400 })).toContain("E-mail ou senha inválidos");
    expect(loginErrorMessage({ name: "AuthRetryableFetchError", status: 0 })).toContain("indisponível");
    expect(loginErrorMessage({ status: 503 })).toContain("indisponível");
  });
  it("orienta confirmação e limite de tentativas", () => {
    expect(loginErrorMessage({ code: "email_not_confirmed" })).toContain("Confirme");
    expect(loginErrorMessage({ status: 429 })).toContain("Aguarde");
  });
  it("não classifica erros desconhecidos como senha incorreta", () => {
    expect(loginErrorMessage({ code: "unexpected_failure" })).not.toContain("senha inválidos");
  });
});
