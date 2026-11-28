import { describe, expect, it } from "vitest";
import { firstName, formatPhone, readyMessage, validPhone, whatsappE164 } from "./client-contact";

describe("contato do cliente", () => {
  it("normaliza o WhatsApp para o envio", () => {
    expect(whatsappE164("(12) 99697-6233")).toBe("+5512996976233");
    expect(whatsappE164("5512996976233")).toBe("+5512996976233");
    expect(whatsappE164("1234")).toBeNull();
    expect(validPhone("12 3333-4444")).toBe(true);
  });
  it("mostra o telefone fácil de conferir", () => {
    expect(formatPhone("12996976233")).toBe("(12) 99697-6233");
    expect(formatPhone("5512996976233")).toBe("(12) 99697-6233");
    expect(formatPhone("1233334444")).toBe("(12) 3333-4444");
  });
  it("mensagem de pronto curta, com o primeiro nome e a loja", () => {
    const text = readyMessage("Maria Souza");
    expect(text).toContain("Olá, Maria!");
    expect(text).toContain("Gold Finger Cruzeiro");
    expect(text).toContain("prontos");
    expect(firstName("  ")).toBe("cliente");
  });
});
