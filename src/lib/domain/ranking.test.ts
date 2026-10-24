import { describe, expect, it } from "vitest";
import { goalProgress, rankAssemblers, rankByOrders } from "./ranking";

describe("ranking", () => {
  it("pontua montagens, prazo, etapas e desconta ocorrências", () => {
    const entries = rankAssemblers({
      people: [{ id: "a", name: "Ana" }, { id: "b", name: "Bruno" }, { id: "c", name: "Caio" }],
      steps: [
        { order_id: "1", step_key: "facetadora", assignee_id: "a", completed_at: "2026-10-20T10:00:00Z" },
        { order_id: "1", step_key: "blocagem", assignee_id: "a", completed_at: "2026-10-20T09:00:00Z" },
        { order_id: "2", step_key: "facetadora", assignee_id: "b", completed_at: "2026-10-22T10:00:00Z" },
      ],
      occurrences: [{ order_id: "2", step_key: null }],
      dueByOrder: new Map([["1", "2026-10-21T00:00:00Z"], ["2", "2026-10-21T00:00:00Z"]]),
      goal: 4,
    });
    expect(entries.map((entry) => [entry.name, entry.score])).toEqual([["Ana", 15], ["Bruno", 0], ["Caio", 0]]);
    expect(goalProgress(entries[0])).toEqual({ percent: 25, missing: 3 });
  });

  it("conta OS por vendedor sem as canceladas", () => {
    const entries = rankByOrders({
      subjects: [{ id: "s1", name: "Bia" }],
      orders: [
        { id: "1", due_at: null, seller_id: "s1", store_id: null, status: "entregue", completed_at: null },
        { id: "2", due_at: null, seller_id: "s1", store_id: null, status: "cancelado", completed_at: null },
      ],
      field: "seller_id",
      goal: null,
      now: new Date("2026-10-23T12:00:00Z"),
    });
    expect(entries[0]).toMatchObject({ name: "Bia", score: 1 });
    expect(goalProgress(entries[0])).toBeNull();
  });
});
