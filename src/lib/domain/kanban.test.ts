import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/lib/types";
import { selectBoardOrders } from "./kanban";

const now = new Date("2026-11-16T12:00:00Z");
const options = { query: "", focus: "all", sellerId: "", sort: "risk" } as const;
const base: OrderRow = {
  id: "base", number: "OS-2026-000001", external_order_id: "123", client_name: "João Silva",
  seller_id: "seller-a", seller_name: "Márcia", laboratory_id: "lab", laboratory_name: "Central",
  laboratory_color: "#087e83", laboratory_code: "CT", entered_at: "2026-11-15T12:00:00Z",
  due_at: "2026-11-20T12:00:00Z", notes: null, service_description: "Montagem", status: "em_montagem",
  priority: "normal", lens_spec: {}, completed_at: null, delivered_at: null, urgency: "verde",
  created_at: "2026-11-15T12:00:00Z", steps_done: 2,
};
const order = (id: string, values: Partial<OrderRow> = {}): OrderRow => ({ ...base, id, ...values });

describe("quadro operacional", () => {
  it("prioriza atraso real e previsão de chegada das lentes antes da urgência antiga", () => {
    const rows = [order("normal"), order("critical", { priority: "critica" }),
      order("risk", { status: "aguardando_lentes", lens_expected_at: "2026-11-20T12:00:00Z" }),
      order("late", { due_at: "2026-11-16T11:00:00Z" })];
    expect(selectBoardOrders(rows, options, now).map((row) => row.id)).toEqual(["late", "risk", "critical", "normal"]);
    expect(rows[0].id).toBe("normal");
  });
  it("busca sem acentos por cliente, vendedor, OS externa e pedido", () => {
    const rows = [order("match", { lens_supplier_ref: "PED-99" })];
    for (const query of ["joao", "marcia", "123", "ped-99"]) {
      expect(selectBoardOrders(rows, { ...options, query }, now)).toHaveLength(1);
    }
  });
  it("combina vendedor e falta de previsão sem incluir lentes já na montagem", () => {
    const rows = [order("waiting", { status: "aguardando_lentes" }), order("assembly"),
      order("other", { status: "aguardando_lentes", seller_id: "seller-b" }),
      order("eta", { status: "aguardando_lentes", lens_expected_at: "2026-11-17T12:00:00Z" })];
    expect(selectBoardOrders(rows, { ...options, focus: "missing_eta", sellerId: "seller-a" }, now).map((row) => row.id)).toEqual(["waiting"]);
  });
  it("mantém prontas fora do filtro de risco mesmo com prazo vencido", () => {
    expect(selectBoardOrders([order("ready", { status: "pronto", due_at: "2026-11-10T12:00:00Z" })], { ...options, focus: "risk" }, now)).toEqual([]);
  });
  it("ordena prazos sem prazo ao final e permite fila por antiguidade", () => {
    const rows = [order("no-due", { due_at: null, entered_at: "2026-11-01T12:00:00Z" }), order("due")];
    expect(selectBoardOrders(rows, { ...options, sort: "deadline" }, now).map((row) => row.id)).toEqual(["due", "no-due"]);
    expect(selectBoardOrders(rows, { ...options, sort: "oldest" }, now).map((row) => row.id)).toEqual(["no-due", "due"]);
  });
});
