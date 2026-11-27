import { describe, expect, it } from "vitest";
import { auditPositionOf, describeAudit, planAudit } from "./audit";

const o = (status: string, frame_state: string | null = "unknown", lens_arrived_at: string | null = null) => ({ status, frame_state, lens_arrived_at });

describe("posição na auditoria", () => {
  it("lê VTA, correção e OS fechadas", () => {
    expect(auditPositionOf(o("aguardando_lentes", "vta", "2026-11-26"))).toBe("vta");
    expect(auditPositionOf(o("aguardando_lentes", "vta"))).toBe("aguardando_lentes");
    expect(auditPositionOf(o("em_correcao"))).toBe("em_montagem");
    expect(auditPositionOf(o("entregue"))).toBeNull();
  });
});

describe("caminho para corrigir", () => {
  it("confere quando já está no lugar", () => {
    expect(planAudit(o("pronto"), "pronto")).toEqual([]);
    expect(planAudit(o("em_correcao"), "em_montagem")).toEqual([]);
  });
  it("lente que chegou e não foi registrada", () => {
    expect(planAudit(o("aguardando_lentes"), "aguardando_montagem")).toEqual([{ kind: "lente" }]);
    expect(planAudit(o("aguardando_lentes"), "em_montagem")).toEqual([{ kind: "lente" }, { kind: "status", to: "em_montagem" }]);
    expect(planAudit(o("aguardando_lentes"), "pronto")).toEqual([{ kind: "lente" }, { kind: "status", to: "pronto" }]);
  });
  it("coloca em VTA com as operações normais", () => {
    expect(planAudit(o("aguardando_lentes"), "vta")).toEqual([{ kind: "vta" }]);
    expect(planAudit(o("aguardando_lentes", "vta"), "vta")).toEqual([{ kind: "lente" }]);
    expect(planAudit(o("aguardando_montagem", "unknown", "x"), "vta")).toEqual([{ kind: "status", to: "aguardando_lentes" }, { kind: "vta" }]);
    expect(planAudit(o("aguardando_lentes", "vta", "x"), "em_montagem")).toEqual([{ kind: "armacao" }, { kind: "status", to: "em_montagem" }]);
  });
  it("pronto dado por engano usa a função de reposição", () => {
    expect(planAudit(o("pronto"), "em_montagem")).toEqual([{ kind: "reposicao", to: "em_montagem" }]);
    expect(planAudit(o("pronto"), "aguardando_lentes")).toEqual([{ kind: "reposicao", to: "aguardando_lentes" }]);
  });
  it("médico e conferência", () => {
    expect(planAudit(o("em_conferencia"), "pronto")).toEqual([{ kind: "status", to: "pronto" }]);
    expect(planAudit(o("pronto"), "em_conferencia")).toEqual([{ kind: "status", to: "em_conferencia" }]);
    expect(planAudit(o("em_montagem"), "em_conferencia")).toEqual([{ kind: "status", to: "em_conferencia" }]);
  });
  it("recusa OS fora do laboratório e caminhos impossíveis", () => {
    expect(planAudit(o("entregue"), "pronto")).toBeNull();
    expect(planAudit(o("em_conferencia"), "aguardando_lentes")).toBeNull();
  });
  it("descreve os passos", () => {
    expect(describeAudit([{ kind: "lente" }, { kind: "status", to: "em_montagem" }])).toBe("lente chegou → em montagem");
  });
});

describe("número na folha de auditoria", async () => {
  const { AUTO_NUMBER, visibleOrderNumber } = await import("./orders");
  it("mostra o número da loja e esconde só o código automático", () => {
    expect(AUTO_NUMBER.test(visibleOrderNumber({ number: "18452", external_order_id: null }))).toBe(false);
    expect(AUTO_NUMBER.test(visibleOrderNumber({ number: "OS-2026-000123", external_order_id: null }))).toBe(true);
    expect(visibleOrderNumber({ number: "OS-2026-000123", external_order_id: "9981" })).toBe("9981");
  });
});
