import type { OrderRow } from "@/lib/types";
import { forecastOrder, type Risk } from "./forecast";
import { visibleOrderNumber } from "./orders";

export type BoardFocus = "all" | "risk" | "critical" | "missing_eta";
export type BoardSort = "risk" | "deadline" | "oldest";

const RISK_RANK: Record<Risk, number> = {
  atrasada: 0, risco: 1, atencao: 2, sem_prazo: 3, no_prazo: 4,
  pronta: 5, entregue: 6, cancelada: 7,
};

export function orderForecast(order: OrderRow, now: Date) {
  return forecastOrder({ status: order.status, dueAt: order.due_at, lensExpectedAt: order.lens_expected_at, stepsDone: order.steps_done, now });
}

function searchable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function selectBoardOrders(orders: OrderRow[], options: { query: string; focus: BoardFocus; sellerId: string; sort: BoardSort }, now: Date) {
  const query = searchable(options.query.trim());
  const rows = orders.map((order) => ({ order, risk: orderForecast(order, now).risk })).filter(({ order, risk }) => {
    if (options.sellerId && order.seller_id !== options.sellerId) return false;
    if (query && !searchable([visibleOrderNumber(order), order.number, order.client_name, order.seller_name, order.store_name, order.laboratory_name, order.lens_supplier_ref].filter(Boolean).join(" ")).includes(query)) return false;
    if (options.focus === "risk" && !["atrasada", "risco", "atencao"].includes(risk)) return false;
    if (options.focus === "critical" && order.priority !== "critica") return false;
    if (options.focus === "missing_eta" && !(order.status === "aguardando_lentes" && !order.lens_expected_at)) return false;
    return true;
  });
  const deadline = (order: OrderRow) => order.due_at ? new Date(order.due_at).getTime() : Infinity;
  return rows.sort((a, b) => {
    if (options.sort === "risk") {
      const risk = RISK_RANK[a.risk] - RISK_RANK[b.risk];
      if (risk) return risk;
      const priority = Number(b.order.priority === "critica") - Number(a.order.priority === "critica");
      if (priority) return priority;
    }
    if (options.sort !== "oldest") {
      const due = deadline(a.order) - deadline(b.order);
      if (due && !Number.isNaN(due)) return due;
    }
    return a.order.entered_at.localeCompare(b.order.entered_at) || a.order.id.localeCompare(b.order.id);
  }).map(({ order }) => order);
}
