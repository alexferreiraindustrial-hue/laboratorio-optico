import { describe, expect, it } from "vitest";
import { validateGuidedEntry } from "./guided-entry";
import { dateTimeLocalToIso } from "./calendar";

const now = new Date("2026-11-19T12:00:00Z");
const input = { laboratoryId: "lab", sellerId: "seller", storeId: "", orderRef: "4521", clientName: "", dueAt: "2026-11-20T18:00:00Z" };

describe("cadastro guiado", () => {
  it("permite começar sem cliente nem loja, preservando o cadastro rápido", () => {
    expect(validateGuidedEntry(input, now)).toBeNull();
  });
  it("exige laboratório, vendedor e o número do papel", () => {
    for (const key of ["laboratoryId", "sellerId", "orderRef"] as const) {
      expect(validateGuidedEntry({ ...input, [key]: "" }, now)).not.toBeNull();
    }
    expect(validateGuidedEntry({ ...input, orderRef: "   " }, now)).not.toBeNull();
  });
  it("não aceita prazo vazio, inválido, passado ou igual ao instante do cadastro", () => {
    for (const dueAt of ["", "inválido", "2026-11-18T12:00:00Z", now.toISOString()]) {
      expect(validateGuidedEntry({ ...input, dueAt }, now)).not.toBeNull();
    }
  });
  it("interpreta o prazo prometido no horário de Brasília", () => {
    const dueAt = dateTimeLocalToIso("2026-11-20T15:00");
    expect(dueAt).toBe("2026-11-20T18:00:00.000Z");
    expect(validateGuidedEntry({ ...input, dueAt }, now)).toBeNull();
  });
});
