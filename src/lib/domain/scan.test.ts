import { describe, expect, it } from "vitest";
import { code128Encodable, code128Widths } from "./code128";
import { compareForecast } from "./label-dates";
import { parseScanCode, scanAlreadyDone, scanBlockReason } from "./scan";

const label = (status: string) => status;

describe("código de barras", () => {
  it("gera Code 128 com início, verificador e fim", () => {
    const widths = code128Widths("OS-1");
    // 6 módulos por caractere (início + 4 + verificador) + 7 do fim
    expect(widths.length).toBe(6 * 6 + 7);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(11 * 6 + 13);
  });
  it("calcula o verificador padrão (PJJ123C)", () => {
    // Conferido contra a biblioteca python-barcode: "PJJ123C" tem verificador 55
    const widths = code128Widths("PJJ123C");
    const check = widths.slice(6 * 8, 6 * 9).join("");
    expect(check).toBe("311321");
  });
  it("recusa acentos", () => {
    expect(code128Encodable("OS çã")).toBe(false);
    expect(code128Encodable("OS-2026-000123")).toBe(true);
  });
});

describe("leitura do bipe", () => {
  it("lê número da OS", () => {
    expect(parseScanCode(" OS-2026-000123\n")).toEqual({ ref: "OS-2026-000123" });
  });
  it("lê o link do QR Code", () => {
    expect(parseScanCode("https://lab.oticahub.com/laboratorio/0f8fad5b-d9cb-469f-a165-70867728950e")).toEqual({ id: "0f8fad5b-d9cb-469f-a165-70867728950e" });
    expect(parseScanCode("https://x/montagem?os=0F8FAD5B-D9CB-469F-A165-70867728950E")).toEqual({ id: "0f8fad5b-d9cb-469f-a165-70867728950e" });
  });
  it("ignora vazio", () => {
    expect(parseScanCode("  ")).toBeNull();
  });
  it("explica quando a OS não está na etapa", () => {
    expect(scanBlockReason("lente", { status: "em_montagem" }, label)).toBe('Está em "em_montagem".');
    expect(scanBlockReason("lente", { status: "aguardando_lentes" }, label)).toBeNull();
    expect(scanBlockReason("pronto", { status: "em_conferencia", medicalRequired: true, medicalApproved: null }, label)).toMatch(/médico/);
    expect(scanBlockReason("voltou", { status: "em_conferencia", medicalRequired: true, medicalApproved: null }, label)).toBeNull();
  });
});

describe("previsão do laboratório x prazo do serviço", () => {
  it("avisa quando a lente chega depois", () => {
    expect(compareForecast("2026-11-20T15:00:00Z", "2026-11-22T15:00:00Z")).toEqual({ tone: "risco", label: "Lente chega 2 dias depois do prazo" });
  });
  it("sem previsão do laboratório", () => {
    expect(compareForecast("2026-11-20T15:00:00Z", null).tone).toBe("falta");
  });
  it("antes do prazo", () => {
    expect(compareForecast("2026-11-22T15:00:00Z", "2026-11-20T15:00:00Z").tone).toBe("ok");
  });
});

import { deadlineText, pdvAlerts, radarGroups, type RadarOrder } from "./pdv";

describe("radar do PDV", () => {
  const now = new Date("2026-11-25T15:00:00Z");
  const base = { external_order_id: null, client_name: "C", lens_expected_at: null } as const;
  const orders: RadarOrder[] = [
    { ...base, id: "a", number: "1", status: "em_montagem", due_at: "2026-11-25T10:00:00Z" },
    { ...base, id: "b", number: "2", status: "aguardando_montagem", due_at: "2026-11-25T17:00:00Z" },
    { ...base, id: "c", number: "3", status: "em_montagem", due_at: "2026-12-10T17:00:00Z" },
    { ...base, id: "d", number: "4", status: "pronto", due_at: "2026-11-20T17:00:00Z" },
  ];
  it("separa atrasadas e as que vão atrasar; pronta não entra", () => {
    const { lanes, counts } = radarGroups(orders, now);
    expect(lanes.atrasada.map((item) => item.order.id)).toEqual(["a"]);
    expect([...lanes.risco, ...lanes.atencao].map((item) => item.order.id)).toEqual(["b"]);
    expect(counts.pronto).toBe(1);
  });
  it("texto do prazo", () => {
    expect(deadlineText("2026-11-25T10:00:00Z", now)).toBe("atrasou há 5 h");
    expect(deadlineText("2026-11-25T18:00:00Z", now)).toBe("vence em 3 h");
  });
});

describe("avisos do PDV", () => {
  it("lista só o que tem OS, com atrasadas primeiro", () => {
    const now = new Date("2026-11-25T15:00:00Z");
    const alerts = pdvAlerts([
      { id: "a", number: "1", external_order_id: null, client_name: "A", status: "em_montagem", due_at: "2026-11-25T10:00:00Z", lens_expected_at: null },
      { id: "b", number: "2", external_order_id: null, client_name: "B", status: "aguardando_lentes", due_at: "2026-12-10T10:00:00Z", lens_expected_at: "2026-11-24T10:00:00Z" },
    ], now, { unreadMessages: 2 });
    expect(alerts.map((item) => item.key)).toEqual(["atrasadas", "lentes", "recados"]);
    expect(alerts[2].text).toBe("recados novos das vendedoras");
  });
});

describe("bipe repetido", () => {
  it("reconhece a OS que já está no resultado da ação", () => {
    expect(scanAlreadyDone("pronto", { status: "pronto" })).toBe(true);
    expect(scanAlreadyDone("lente", { status: "aguardando_montagem" })).toBe(true);
    expect(scanAlreadyDone("medico", { status: "em_conferencia" })).toBe(true);
    expect(scanAlreadyDone("voltou", { status: "pronto", medicalApproved: "2026-11-26T10:00:00Z" })).toBe(true);
  });
  it("não confunde com uma OS que ainda precisa da ação", () => {
    expect(scanAlreadyDone("pronto", { status: "em_montagem" })).toBe(false);
    expect(scanAlreadyDone("voltou", { status: "pronto" })).toBe(false);
    expect(scanAlreadyDone("lente", { status: "aguardando_lentes" })).toBe(false);
    expect(scanAlreadyDone("entregue", { status: "entregue" })).toBe(false);
  });
});

describe("VTA e correção de posição no bipe", () => {
  it("armação chegou só vale para OS marcada como VTA", () => {
    expect(scanBlockReason("armacao", { status: "aguardando_lentes", frameState: "vta", lensArrived: "x" }, label)).toBeNull();
    expect(scanBlockReason("armacao", { status: "aguardando_lentes", frameState: "unknown" }, label)).toContain("VTA");
    expect(scanBlockReason("armacao", { status: "pronto", frameState: "vta" }, label)).toContain("pronto");
  });
  it("lente chegou repetida em VTA ou já em montagem não vira erro", () => {
    expect(scanAlreadyDone("lente", { status: "aguardando_lentes", frameState: "vta", lensArrived: "x" })).toBe(true);
    expect(scanAlreadyDone("lente", { status: "em_montagem" })).toBe(true);
    expect(scanAlreadyDone("lente", { status: "aguardando_lentes", frameState: "vta" })).toBe(false);
  });
  it("corrigir posição aceita pronto e as etapas de antes, recusa entregue", () => {
    expect(scanBlockReason("corrigir", { status: "pronto" }, label)).toBeNull();
    expect(scanBlockReason("corrigir", { status: "aguardando_montagem" }, label)).toBeNull();
    expect(scanBlockReason("corrigir", { status: "entregue" }, label)).toContain("entregue");
  });
});
