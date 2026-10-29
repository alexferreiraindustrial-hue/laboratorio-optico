import { describe, expect, it } from "vitest";
import { forecastOrder, journeyIndex, progressPercent, sellerUpdateMessage, whatsappLink } from "./forecast";
import { parseQuickBatch, parseQuickEntry, quickClientName, systemNumberCandidates } from "./quick-entry";

const now = new Date("2026-10-23T12:00:00-03:00");
const inHours = (h: number) => new Date(now.getTime() + h * 36e5).toISOString();

describe("progresso", () => {
  it("cresce com as etapas da montagem", () => {
    expect(progressPercent("aguardando_lentes")).toBe(10);
    expect(progressPercent("em_montagem", 0)).toBe(30);
    expect(progressPercent("em_montagem", 5)).toBe(85);
    expect(progressPercent("pronto")).toBe(100);
  });
  it("mapeia a jornada do vendedor", () => {
    expect(journeyIndex("aguardando_lentes")).toBe(1);
    expect(journeyIndex("em_conferencia")).toBe(3);
    expect(journeyIndex("entregue")).toBe(5);
  });
});

describe("previsão de atraso", () => {
  it("avisa risco antes do prazo vencer", () => {
    const result = forecastOrder({ status: "aguardando_lentes", dueAt: inHours(10), now });
    expect(result.risk).toBe("risco");
    expect(result.slackHours!).toBeLessThan(0);
  });
  it("marca atrasada quando o prazo passou", () => {
    expect(forecastOrder({ status: "em_montagem", dueAt: inHours(-1), now }).risk).toBe("atrasada");
  });
  it("mostra atenção com folga curta", () => {
    expect(forecastOrder({ status: "em_montagem", stepsDone: 2, dueAt: inHours(4), now }).risk).toBe("atencao");
  });
  it("fica no prazo com margem", () => {
    expect(forecastOrder({ status: "aguardando_montagem", dueAt: inHours(72), now }).risk).toBe("no_prazo");
  });
  it("trata prontas e sem prazo", () => {
    expect(forecastOrder({ status: "pronto", dueAt: inHours(-5), now }).risk).toBe("pronta");
    expect(forecastOrder({ status: "em_montagem", dueAt: null, now }).risk).toBe("sem_prazo");
  });
});

describe("comunicação com vendedor", () => {
  it("monta mensagem e link do WhatsApp", () => {
    const forecast = forecastOrder({ status: "aguardando_lentes", dueAt: inHours(10), now });
    const text = sellerUpdateMessage({ sellerName: "Ana Norte", number: "OS-2026-000004", clientName: "Maria", status: "aguardando_lentes", dueAt: inHours(10), forecast });
    expect(text).toContain("Ana");
    expect(text).toContain("Pode não ficar pronta");
    expect(whatsappLink("(12) 99123-4567", text)).toMatch(/^https:\/\/wa\.me\/5512991234567\?text=/);
    expect(whatsappLink("123", text)).toBeNull();
  });
});

describe("lançamento rápido", () => {
  it("entende OS + nome em qualquer ordem", () => {
    expect(parseQuickEntry("4521 Maria Souza")).toMatchObject({ orderRef: "4521", clientName: "Maria Souza" });
    expect(parseQuickEntry("Maria Souza 4521")).toMatchObject({ orderRef: "4521", clientName: "Maria Souza" });
    expect(parseQuickEntry("OS 4521 Maria")).toMatchObject({ orderRef: "4521", clientName: "Maria" });
  });
  it("aceita só OS ou só nome", () => {
    expect(parseQuickEntry("4521")).toMatchObject({ orderRef: "4521", clientName: null });
    expect(parseQuickEntry("João da Silva")).toMatchObject({ orderRef: null, clientName: "João da Silva" });
    expect(quickClientName(parseQuickEntry("4521")!)).toBe("OS 4521");
  });
  it("reconhece número do sistema e listas coladas", () => {
    expect(parseQuickEntry("os-2026-000004")?.orderRef).toBe("OS-2026-000004");
    expect(parseQuickBatch("101 Ana\n\n102 Bia; Carla")).toHaveLength(3);
    expect(systemNumberCandidates("4", 2026)[0]).toBe("OS-2026-000004");
  });
  it("aceita códigos com letras, hífen e prefixos", () => {
    expect(parseQuickEntry("TESTE-901 Teste Claude")).toMatchObject({ orderRef: "TESTE-901", clientName: "Teste Claude" });
    expect(parseQuickEntry("PED-NORTE-001")).toMatchObject({ orderRef: "PED-NORTE-001", clientName: null });
    expect(parseQuickEntry("4521-B Ana")).toMatchObject({ orderRef: "4521-B", clientName: "Ana" });
    expect(parseQuickEntry("nº4521 Ana")).toMatchObject({ orderRef: "4521", clientName: "Ana" });
    expect(parseQuickEntry("#4521")).toMatchObject({ orderRef: "4521" });
    expect(parseQuickEntry("Osvaldo Nogueira")).toMatchObject({ orderRef: null, clientName: "Osvaldo Nogueira" });
    expect(parseQuickEntry("Ana Maria-Souza")).toMatchObject({ orderRef: null });
  });
  it("não repete o prefixo OS na mensagem ao vendedor", () => {
    const forecast = forecastOrder({ status: "em_montagem", dueAt: null, stepsDone: 0, now: new Date() });
    const text = sellerUpdateMessage({ number: "OS-2026-000003", clientName: "Ana", sellerName: "Bia", status: "em_montagem", dueAt: null, forecast });
    expect(text).toContain("\nOS-2026-000003 ·");
    expect(text).not.toContain("OS OS-");
    const withStoreOs = sellerUpdateMessage({
      number: "OS-2026-000010",
      externalOrderId: "4521",
      clientName: "Maria",
      sellerName: "Ana",
      status: "em_montagem",
      dueAt: null,
      forecast,
    });
    expect(withStoreOs).toContain("OS 4521 · Maria");
    expect(withStoreOs).not.toContain("OS-2026-000010");
  });
});
