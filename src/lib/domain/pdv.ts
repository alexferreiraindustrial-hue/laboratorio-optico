// PDV da produção: agrupa as OS abertas pelo risco de prazo para o radar da tela de bipe.
import type { OrderStatus } from "./constants";
import { forecastOrder, formatHoursShort } from "./forecast";

export type RadarOrder = { id: string; number: string; external_order_id: string | null; client_name: string; status: OrderStatus; due_at: string | null; lens_expected_at: string | null; seller_name?: string | null };
export type RadarLane = "atrasada" | "risco" | "atencao";

export const RADAR_STATUSES: OrderStatus[] = ["aguardando_lentes", "aguardando_montagem", "em_montagem", "em_correcao", "em_conferencia", "pronto"];

export function radarGroups(orders: RadarOrder[], now: Date) {
  const lanes: Record<RadarLane, { order: RadarOrder; reason: string }[]> = { atrasada: [], risco: [], atencao: [] };
  const counts: Partial<Record<OrderStatus, number>> = {};
  for (const order of orders) {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
    if (order.status === "pronto") continue;
    const forecast = forecastOrder({ status: order.status, dueAt: order.due_at, lensExpectedAt: order.lens_expected_at, now });
    if (forecast.risk === "atrasada" || forecast.risk === "risco" || forecast.risk === "atencao") lanes[forecast.risk].push({ order, reason: forecast.reason });
  }
  const byDue = (a: { order: RadarOrder }, b: { order: RadarOrder }) => Date.parse(a.order.due_at ?? "9999") - Date.parse(b.order.due_at ?? "9999");
  lanes.atrasada.sort(byDue); lanes.risco.sort(byDue); lanes.atencao.sort(byDue);
  return { lanes, counts };
}

/** "atrasou há 5 h" / "vence em 3 h" */
export function deadlineText(dueAt: string | null, now: Date) {
  if (!dueAt) return "sem prazo";
  const hours = (Date.parse(dueAt) - now.getTime()) / 36e5;
  return hours < 0 ? `atrasou há ${formatHoursShort(hours)}` : `vence em ${formatHoursShort(hours)}`;
}
