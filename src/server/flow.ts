import { zonedYmd } from "@/lib/domain/calendar";
import { requireProfile } from "./session";

export type LensQueueRow = {
  id: string;
  number: string;
  client_name: string;
  external_order_id: string | null;
  seller_id: string | null;
  seller_name: string | null;
  store_name: string | null;
  entered_at: string;
  due_at: string | null;
  lens_expected_at: string | null;
  lens_supplier_ref: string | null;
  laboratory_name: string;
  priority: "normal" | "critica";
};

export async function loadLensQueue() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase
    .from("orders_enriched")
    .select("id, number, client_name, external_order_id, seller_id, seller_name, store_name, entered_at, due_at, lens_expected_at, lens_supplier_ref, laboratory_name, priority")
    .eq("status", "aguardando_lentes")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(500);
  return { rows: (data ?? []) as LensQueueRow[], error: error?.message ?? null };
}

/** Desempenho dos laboratórios externos nos últimos 60 dias: prazo de entrega da lente e pontualidade. */
export async function loadSupplierStats() {
  const { supabase } = await requireProfile();
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  const { data } = await supabase
    .from("service_orders")
    .select("entered_at, lens_expected_at, lens_arrived_at")
    .gte("lens_arrived_at", since)
    .limit(2000);
  const rows = data ?? [];
  const leadDays = rows.map((row) => (new Date(row.lens_arrived_at as string).getTime() - new Date(row.entered_at as string).getTime()) / 864e5).filter((value) => value >= 0);
  const withForecast = rows.filter((row) => row.lens_expected_at);
  const onTime = withForecast.filter((row) => new Date(row.lens_arrived_at as string).getTime() <= new Date(row.lens_expected_at as string).getTime() + 12 * 36e5);
  return {
    arrived: rows.length,
    avgLeadDays: leadDays.length ? leadDays.reduce((sum, value) => sum + value, 0) / leadDays.length : null,
    onTime: withForecast.length ? onTime.length / withForecast.length : null,
  };
}

export type BoRow = {
  id: string;
  order_id: string;
  occurred_at: string;
  description: string;
  severity: string;
  status: string;
  step_key: string | null;
  category_name: string;
  decision: string | null;
  decision_note: string | null;
  decided_at: string | null;
  notified_at: string | null;
  corrective_action: string | null;
  order: {
    number: string;
    client_name: string;
    external_order_id: string | null;
    status: string;
    due_at: string | null;
    seller_name: string | null;
    store_name: string | null;
    seller_whatsapp: string | null;
    store_whatsapp: string | null;
  } | null;
};

export async function loadBo() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase
    .from("quality_occurrences")
    .select("id, order_id, occurred_at, description, severity, status, step_key, decision, decision_note, decided_at, notified_at, corrective_action, quality_categories(name)")
    .in("status", ["aberta", "em_tratamento"])
    .order("occurred_at", { ascending: true })
    .limit(300);
  const rows = (data ?? []) as unknown as (Omit<BoRow, "category_name" | "order"> & { quality_categories: { name: string } | null })[];
  const orderIds = [...new Set(rows.map((row) => row.order_id))];
  const orders = new Map<string, BoRow["order"]>();
  if (orderIds.length) {
    const { data: list } = await supabase
      .from("orders_enriched")
      .select("id, number, client_name, external_order_id, status, due_at, seller_id, seller_name, store_id, store_name")
      .in("id", orderIds);
    const sellerIds = [...new Set((list ?? []).map((row) => row.seller_id).filter(Boolean))] as string[];
    const storeIds = [...new Set((list ?? []).map((row) => row.store_id).filter(Boolean))] as string[];
    const [sellers, stores] = await Promise.all([
      sellerIds.length ? supabase.from("sellers").select("id, whatsapp, phone").in("id", sellerIds) : Promise.resolve({ data: [] }),
      storeIds.length ? supabase.from("stores").select("id, whatsapp, phone").in("id", storeIds) : Promise.resolve({ data: [] }),
    ]);
    const sellerPhone = new Map((sellers.data ?? []).map((row) => [row.id as string, (row.whatsapp || row.phone) as string | null]));
    const storePhone = new Map((stores.data ?? []).map((row) => [row.id as string, (row.whatsapp || row.phone) as string | null]));
    for (const row of list ?? []) {
      orders.set(row.id as string, {
        number: row.number as string,
        client_name: row.client_name as string,
        external_order_id: row.external_order_id as string | null,
        status: row.status as string,
        due_at: row.due_at as string | null,
        seller_name: row.seller_name as string | null,
        store_name: row.store_name as string | null,
        seller_whatsapp: row.seller_id ? sellerPhone.get(row.seller_id as string) ?? null : null,
        store_whatsapp: row.store_id ? storePhone.get(row.store_id as string) ?? null : null,
      });
    }
  }
  return {
    rows: rows.map((row) => ({ ...row, category_name: row.quality_categories?.name ?? "Ocorrência", order: orders.get(row.order_id) ?? null })) as BoRow[],
    error: error?.message ?? null,
  };
}

export type RoutineLog = {
  id: string;
  kind: "checklist" | "motoboy" | "nota";
  item_key: string | null;
  label: string;
  lenses_count: number | null;
  notes: string | null;
  done_at: string;
  done_by: string | null;
};

export async function loadRoutine() {
  const { supabase } = await requireProfile();
  const today = zonedYmd(new Date());
  const { data, error } = await supabase
    .from("routine_logs")
    .select("id, kind, item_key, label, lenses_count, notes, done_at, done_by")
    .eq("day", today)
    .order("done_at", { ascending: true });
  return { logs: (data ?? []) as RoutineLog[], today, error: error?.message ?? null };
}
