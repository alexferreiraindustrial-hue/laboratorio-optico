import { describe, it, expect } from "vitest";
import {
  feedbackPending,
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
