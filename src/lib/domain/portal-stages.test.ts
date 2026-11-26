import { describe, expect, it } from "vitest";
import { SELLER_PRODUCTION, sellerStage, sellerStageInfo } from "./portal-stages";

describe("etapas para a vendedora", () => {
  it("traduz cada status do laboratório", () => {
    expect(sellerStage("aguardando_lentes")).toBe("lentes");
    expect(sellerStage("aguardando_montagem")).toBe("fila");
    expect(sellerStage("em_correcao")).toBe("bancada");
    expect(sellerStage("em_conferencia")).toBe("conferencia");
    expect(sellerStage("pronto")).toBe("pronta");
    expect(sellerStage("cancelado")).toBe("cancelada");
  });
  it("explica o momento e mantém a ordem da produção", () => {
    expect(sellerStageInfo("pronto").tip).toContain("cliente");
    expect(SELLER_PRODUCTION).toEqual(["lentes", "fila", "bancada", "conferencia"]);
  });
});
