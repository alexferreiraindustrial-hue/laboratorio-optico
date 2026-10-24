import { cache } from "react";
import type { OrderStatus } from "@/lib/domain/constants";
import type { Laboratory, OrderRow, Seller, SellerStoreLink, Store } from "@/lib/types";
import { requireProfile } from "./session";

export type OrderFilters = {
  q?: string;
  status?: string;
  laboratory?: string;
  urgency?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: string;
  view?: string;
  tab?: string;
};

export const ORDER_TABS = ["andamento", "atrasadas", "ocorrencia", "prontas", "encerradas", "todas"] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

export const ORDER_TAB_LABEL: Record<OrderTab, string> = {
  andamento: "Em andamento",
  atrasadas: "Atrasadas",
  ocorrencia: "Com ocorrência",
  prontas: "Prontas",
  encerradas: "Encerradas",
  todas: "Todas",
};

const IN_PROGRESS: OrderStatus[] = ["aguardando_lentes", "aguardando_montagem", "em_montagem", "em_correcao", "em_conferencia", "pronto"];

const TAB_FILTERS: Record<OrderTab, OrderStatus[] | null> = {
  andamento: IN_PROGRESS,
  atrasadas: IN_PROGRESS.filter((status) => status !== "pronto"),
  ocorrencia: null,
  prontas: ["pronto"],
  encerradas: ["entregue", "cancelado"],
  todas: null,
};

export function isOrderTab(value: string): value is OrderTab {
  return (ORDER_TABS as readonly string[]).includes(value);
}

async function openOccurrenceOrderIds() {
  const { supabase } = await requireProfile();
  const { data } = await supabase.from("quality_occurrences").select("order_id").in("status", ["aberta", "em_tratamento"]);
  return [...new Set((data ?? []).map((row) => row.order_id as string))];
}

export async function loadOrderTabCounts() {
  const { supabase } = await requireProfile();
  const ids = await openOccurrenceOrderIds();
  const base = () => supabase.from("orders_enriched").select("id", { count: "exact", head: true });
  const [andamento, atrasadas, ocorrencia, prontas, encerradas, todas] = await Promise.all([
    base().in("status", IN_PROGRESS),
    base().in("status", TAB_FILTERS.atrasadas!).lt("due_at", new Date().toISOString()),
    ids.length ? base().in("id", ids) : Promise.resolve({ count: 0 }),
    base().eq("status", "pronto"),
    base().in("status", ["entregue", "cancelado"]),
    base(),
  ]);
  return {
    andamento: andamento.count ?? 0,
    atrasadas: atrasadas.count ?? 0,
    ocorrencia: ocorrencia.count ?? 0,
    prontas: prontas.count ?? 0,
    encerradas: encerradas.count ?? 0,
    todas: todas.count ?? 0,
  } satisfies Record<OrderTab, number>;
}

/** Quantas das 5 etapas de montagem cada OS já concluiu. */
export async function stepsDoneByOrder(ids: string[]) {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const { supabase } = await requireProfile();
  for (let index = 0; index < ids.length; index += 150) {
    const { data } = await supabase
      .from("assembly_steps")
      .select("order_id")
      .eq("status", "concluida")
      .in("order_id", ids.slice(index, index + 150));
    for (const row of data ?? []) map.set(row.order_id as string, (map.get(row.order_id as string) ?? 0) + 1);
  }
  return map;
}

function clean(value?: string) {
  return (value ?? "").replace(/[%_,]/g, " ").trim();
}

export const loadCatalogs = cache(async function loadCatalogs() {
  const { supabase } = await requireProfile();
  const [labs, sellers, settings, stores, links] = await Promise.all([
    supabase.from("laboratories").select("id, name, code, color, active, notes").order("name"),
    supabase.from("sellers").select("id, name, active, notes, public_code, phone, whatsapp, email, quick_code").order("name"),
    supabase.from("system_settings").select("key, value"),
    supabase.from("stores").select("id, public_code, trade_name, legal_name, cnpj, contact_name, phone, whatsapp, email, address, notes, active, quick_code").order("trade_name"),
    supabase.from("seller_stores").select("seller_id, store_id"),
  ]);
  return {
    laboratories: (labs.data ?? []) as Laboratory[],
    sellers: (sellers.data ?? []) as Seller[],
    stores: (stores.data ?? []) as Store[],
    sellerLinks: (links.data ?? []) as SellerStoreLink[],
    settings: Object.fromEntries((settings.data ?? []).map((item) => [item.key, item.value])) as Record<string, Record<string, unknown>>,
    errors: [labs.error?.message, sellers.error?.message, settings.error?.message, stores.error?.message, links.error?.message].filter(Boolean),
  };
});

export async function loadOrders(filters: OrderFilters, options?: { statuses?: OrderStatus[]; pageSize?: number }) {
  const { supabase } = await requireProfile();
  const pageSize = options?.pageSize ?? 20;
  const page = Math.max(1, Number(filters.page ?? "1") || 1);
  let query = supabase.from("orders_enriched").select(
    "id, number, client_name, laboratory_id, laboratory_name, laboratory_color, seller_name, store_name, external_order_id, entered_at, due_at, status, urgency",
    { count: "exact" },
  );
  const q = clean(filters.q);
  if (q) {
    query = query.or(
      `number.ilike.%${q}%,client_name.ilike.%${q}%,seller_name.ilike.%${q}%,laboratory_name.ilike.%${q}%,external_order_id.ilike.%${q}%,store_name.ilike.%${q}%`,
    );
  }
  if (filters.status) query = query.eq("status", filters.status);
  else if (filters.tab && isOrderTab(filters.tab)) {
    const tab = filters.tab as OrderTab;
    if (tab === "ocorrencia") {
      const ids = await openOccurrenceOrderIds();
      query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }
    const statuses = TAB_FILTERS[tab];
    if (statuses) query = query.in("status", statuses);
    if (tab === "atrasadas") query = query.lt("due_at", new Date().toISOString());
  } else if (options?.statuses) query = query.in("status", options.statuses);
  if (filters.laboratory) query = query.eq("laboratory_id", filters.laboratory);
  if (filters.urgency) query = query.eq("urgency", filters.urgency);
  if (filters.from) query = query.gte("entered_at", `${filters.from}T00:00:00-03:00`);
  if (filters.to) query = query.lte("entered_at", `${filters.to}T23:59:59-03:00`);
  if (filters.sort === "entrada") query = query.order("entered_at", { ascending: false });
  else query = query.order("due_at", { ascending: true, nullsFirst: false }).order("entered_at", { ascending: true });

  if (filters.view === "kanban") query = query.limit(400);
  else query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  const rows = (data ?? []) as OrderRow[];
  const counts = await stepsDoneByOrder(rows.map((row) => row.id));
  return {
    orders: rows.map((row) => ({ ...row, steps_done: counts.get(row.id) ?? 0 })),
    count: count ?? 0,
    page,
    pageSize,
    error: error?.message ?? null,
  };
}
