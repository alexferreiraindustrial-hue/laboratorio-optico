import { describe, expect, it } from "vitest";
import { code128Encodable, code128Widths } from "./code128";
import { compareForecast } from "./label-dates";
import { parseScanCode, scanBlockReason } from "./scan";

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
