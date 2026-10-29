import { describe, expect, it } from "vitest";
import { boMessage, boStage, lensRisk, parseTargetCommand } from "./flow";

const now = new Date("2026-10-20T12:00:00Z");
const at = (hours: number) => new Date(now.getTime() + hours * 36e5).toISOString();

describe("risco da lente", () => {
  it("lente prevista com folga para montar fica no prazo", () => {
    expect(lensRisk({ dueAt: at(96), lensExpectedAt: at(24), now }).risk).toBe("ok");
  });
  it("lente que chega depois do limite (prazo menos montagem) vai estourar", () => {
    const result = lensRisk({ dueAt: at(48), lensExpectedAt: at(36), now });
    expect(result.risk).toBe("vai_atrasar");
    expect(result.slackHours).toBe(-12);
  });
  it("folga menor que 12 h é apertado", () => {
    expect(lensRisk({ dueAt: at(60), lensExpectedAt: at(30), now }).risk).toBe("apertado");
  });
  it("previsão vencida e lente não chegou = lente atrasada", () => {
    expect(lensRisk({ dueAt: at(48), lensExpectedAt: at(-5), now }).risk).toBe("lente_atrasada");
  });
  it("sem previsão do laboratório e prazo ainda viável", () => {
    expect(lensRisk({ dueAt: at(72), lensExpectedAt: null, now }).risk).toBe("sem_previsao");
    expect(lensRisk({ dueAt: at(10), lensExpectedAt: null, now }).risk).toBe("vai_atrasar");
  });
  it("lente que já chegou", () => {
    expect(lensRisk({ dueAt: at(10), lensExpectedAt: at(-50), arrivedAt: at(-40), now }).risk).toBe("chegou");
  });
});

describe("atalhos do lançamento", () => {
  it("entende v2, V 3, l1 e l-4", () => {
    expect(parseTargetCommand("v2")).toEqual({ kind: "seller", code: 2 });
    expect(parseTargetCommand("V 3")).toEqual({ kind: "seller", code: 3 });
    expect(parseTargetCommand("l1")).toEqual({ kind: "store", code: 1 });
    expect(parseTargetCommand("l-4")).toEqual({ kind: "store", code: 4 });
  });
  it("não confunde número de OS nem nomes", () => {
    expect(parseTargetCommand("4521")).toBeNull();
    expect(parseTargetCommand("Vanessa")).toBeNull();
    expect(parseTargetCommand("v2 Maria")).toBeNull();
  });
});

describe("BO", () => {
  it("avança de avisar para aguardando decisão e em tratamento", () => {
    expect(boStage({ notified_at: null, decision: null })).toBe("avisar");
    expect(boStage({ notified_at: at(0), decision: null })).toBe("aguardando_decisao");
    expect(boStage({ notified_at: at(0), decision: "nova_lente" })).toBe("em_tratamento");
  });
  it("monta a mensagem para o vendedor", () => {
    const text = boMessage({ sellerName: "Ana Paula", number: "OS-2026-000010", externalOrderId: "4521", clientName: "Maria", step: "Blocagem", category: "Erro de blocagem", description: "Centro óptico deslocado" });
    expect(text).toContain("Olá, Ana!");
    expect(text).toContain("OS 4521");
    expect(text).not.toContain("OS-2026-000010");
    expect(text).toContain("etapa de blocagem");
  });
});
