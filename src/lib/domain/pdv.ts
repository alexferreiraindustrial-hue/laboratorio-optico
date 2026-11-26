// PDV da produção: agrupa as OS abertas pelo risco de prazo para o radar da tela de bipe.
import type { OrderStatus } from "./constants";
import { forecastOrder, formatHoursShort } from "./forecast";

export type RadarOrder = { id: string; number: string; external_order_id: string | null; client_name: string; status: OrderStatus; due_at: string | null; lens_expected_at: string | null; seller_name?: string | null; entered_at?: string | null; completed_at?: string | null; medical_review_required?: boolean | null; medical_review_approved_at?: string | null };
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

export type PdvAlert = { key: string; tone: "late" | "risk" | "info"; count: number; text: string; href: string };

/** Avisos do letreiro do PDV, do mais urgente para o menos urgente. Só aparecem os que têm OS. */
export function pdvAlerts(orders: RadarOrder[], now: Date, extra: { unreadMessages?: number } = {}): PdvAlert[] {
  const { lanes } = radarGroups(orders, now);
  const t = now.getTime();
  const lensLate = orders.filter((o) => o.status === "aguardando_lentes" && o.lens_expected_at && Date.parse(o.lens_expected_at) < t).length;
  const noForecast = orders.filter((o) => o.status === "aguardando_lentes" && !o.lens_expected_at && o.entered_at && t - Date.parse(o.entered_at) > 24 * 36e5).length;
  const doctor = orders.filter((o) => o.status === "em_conferencia" && o.medical_review_required && !o.medical_review_approved_at).length;
  const readyOld = orders.filter((o) => o.status === "pronto" && (o.completed_at ?? o.due_at) && t - Date.parse((o.completed_at ?? o.due_at)!) > 3 * 864e5).length;
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const list: PdvAlert[] = [
    { key: "atrasadas", tone: "late", count: lanes.atrasada.length, text: plural(lanes.atrasada.length, "OS atrasada", "OS atrasadas"), href: "/laboratorio?tab=atrasadas" },
    { key: "vao", tone: "risk", count: lanes.risco.length, text: plural(lanes.risco.length, "OS vai atrasar se não andar", "OS vão atrasar se não andarem"), href: "/laboratorio?tab=atrasadas" },
    { key: "lentes", tone: "late", count: lensLate, text: plural(lensLate, "lente passou da previsão do laboratório", "lentes passaram da previsão do laboratório"), href: "/lentes" },
    { key: "previsao", tone: "risk", count: noForecast, text: plural(noForecast, "OS sem previsão do laboratório há mais de 1 dia", "OS sem previsão do laboratório há mais de 1 dia"), href: "/lentes" },
    { key: "medico", tone: "info", count: doctor, text: plural(doctor, "OS esperando retorno do médico", "OS esperando retorno do médico"), href: "/montagem" },
    { key: "retirada", tone: "info", count: readyOld, text: plural(readyOld, "pronta há mais de 3 dias sem entrega", "prontas há mais de 3 dias sem entrega"), href: "/entrega" },
    { key: "recados", tone: "info", count: extra.unreadMessages ?? 0, text: plural(extra.unreadMessages ?? 0, "recado novo das vendedoras", "recados novos das vendedoras"), href: "/recados" },
  ];
  return list.filter((item) => item.count > 0);
}
