import { describe, it, expect } from "vitest";
import {
  CORRECTION_MARK,
  feedbackMessage,
  feedbackPending,
  followupBySeller,
  followupMetrics,
  percent,
  hasPhone,
  isCorrection,
  stripCorrection,
  matchesFollowup,
  type ClientFollowupRow,
} from "./client-followup";
const row: ClientFollowupRow = {
  id: "delivery",
  order_id: "os",
  client_delivered_at: "2026-11-20T15:00:00Z",
  followup_due_at: "2026-11-25T15:00:00Z",
  client_phone: null,
  contacted_at: null,
  outcome: null,
  feedback_note: null,
  updated_at: "2026-11-20T15:00:00Z",
  number: "TESTE",
  client_name: "Cliente fictício",
  seller_name: "Vendedora de teste",
  seller_id: "seller-a",
};
describe("lembrete de adaptação", () => {
  it("começa exatamente cinco dias após a confirmação, com ou sem telefone", () => {
    expect(feedbackPending(row, new Date("2026-11-25T14:59:59Z"))).toBe(false);
    expect(feedbackPending(row, new Date("2026-11-25T15:00:00Z"))).toBe(true);
    expect(
      feedbackPending(
        { ...row, client_phone: "11999999999" },
        new Date("2026-11-25T15:00:00Z"),
      ),
    ).toBe(true);
  });
  it("contato confirmado sai das pendências sem perder a fila de atenção", () => {
    const contacted = {
      ...row,
      contacted_at: "2026-11-25T16:00:00Z",
      outcome: "precisa_ajuda",
    };
    const now = new Date("2026-11-26T15:00:00Z");
    expect(feedbackPending(contacted, now)).toBe(false);
    expect(matchesFollowup(contacted, "", "contacted", now)).toBe(true);
    expect(matchesFollowup(contacted, "seller-a", "help", now)).toBe(true);
    expect(matchesFollowup(contacted, "seller-b", "help", now)).toBe(false);
  });
  it("preserva o filtro de vendedora em todas as visões", () => {
    const now = new Date("2026-11-21T15:00:00Z");
    expect(matchesFollowup(row, "seller-a", "await", now)).toBe(true);
    expect(matchesFollowup(row, "seller-b", "all", now)).toBe(false);
    expect(matchesFollowup(row, "", "pending", now)).toBe(false);
    expect(matchesFollowup(row, "", "unknown", now)).toBe(false);
  });
});

describe("pós-venda Gold Finger", () => {
  const base = { id: "f", order_id: "o", client_delivered_at: "2026-11-20T12:00:00Z", followup_due_at: "2026-11-25T12:00:00Z", contacted_at: "2026-11-25T13:00:00Z", updated_at: "x", number: "1234", client_name: "Maria Souza", seller_name: null, seller_id: null };
  it("mensagem diz de onde é e cita a OS", () => {
    const text = feedbackMessage("Maria Souza", "1234");
    expect(text).toContain("Olá, Maria!");
    expect(text).toContain("Gold Finger Cruzeiro");
    expect(text).toContain("adaptação");
    expect(text).not.toContain("OS 1234");
  });
  it("separa correção de ajuste sem mudar o banco", () => {
    const fix = { ...base, client_phone: null, outcome: "precisa_ajuda", feedback_note: `${CORRECTION_MARK} lente trocada` };
    const adjust = { ...base, client_phone: null, outcome: "precisa_ajuda", feedback_note: "apertar a haste" };
    expect(isCorrection(fix)).toBe(true);
    expect(stripCorrection(fix.feedback_note)).toBe("lente trocada");
    expect(matchesFollowup(fix, "", "correction", new Date())).toBe(true);
    expect(matchesFollowup(fix, "", "help", new Date())).toBe(false);
    expect(matchesFollowup(adjust, "", "help", new Date())).toBe(true);
  });
  it("filtra quem tem WhatsApp", () => {
    expect(matchesFollowup({ ...base, client_phone: "12999998888", outcome: null, feedback_note: null }, "", "phone", new Date())).toBe(true);
    expect(matchesFollowup({ ...base, client_phone: null, outcome: null, feedback_note: null }, "", "phone", new Date())).toBe(false);
    expect(hasPhone("(12) 3333")).toBe(false);
  });
});

describe("métricas do pós-venda", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  const mk = (id: string, seller: string, daysAgo: number, outcome: string | null, note: string | null = null, contacted = true): ClientFollowupRow => ({
    id, order_id: id, number: id, client_name: "C", seller_name: seller, seller_id: seller,
    client_delivered_at: new Date(now.getTime() - daysAgo * 864e5).toISOString(),
    followup_due_at: new Date(now.getTime() - (daysAgo - 5) * 864e5).toISOString(),
    client_phone: null, contacted_at: contacted ? now.toISOString() : null, outcome, feedback_note: note, updated_at: "x",
  });
  const rows = [
    mk("1", "Ju", 10, "adaptacao_ok"), mk("2", "Ju", 12, "adaptacao_ok"), mk("3", "Pa", 8, "precisa_ajuda"),
    mk("4", "Pa", 9, "precisa_ajuda", `${CORRECTION_MARK} grau`), mk("5", "Ju", 7, null, null, false), mk("6", "Ju", 60, "sem_resposta"),
  ];
  it("conta resultados e separa correção de ajuste", () => {
    const m = followupMetrics(rows, now, null);
    expect(m).toMatchObject({ delivered: 6, contacted: 5, ok: 2, adjust: 1, correction: 1, noAnswer: 1, toContact: 1, answered: 4 });
    expect(percent(m.ok, m.answered)).toBe("50%");
    expect(percent(1, 0)).toBe("—");
  });
  it("respeita o período e separa por vendedora", () => {
    const from = new Date(now.getTime() - 30 * 864e5);
    expect(followupMetrics(rows, now, from).delivered).toBe(5);
    const sellers = followupBySeller(rows, now, from);
    expect(sellers.map((s) => [s.name, s.metrics.delivered, s.metrics.ok])).toEqual([["Ju", 3, 2], ["Pa", 2, 0]]);
  });
});
