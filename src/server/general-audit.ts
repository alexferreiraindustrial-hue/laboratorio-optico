import { requireProfile } from "./session";

export type GeneralAuditOrder = {
  id: string;
  number: string;
  external_order_id: string | null;
  client_name: string;
  seller_name: string | null;
  status: string;
  found_at: string | null;
  found_position: string | null;
};
export type OffOrder = { id: string; number: string; external_order_id: string | null; client_name: string; seller_name: string | null; status: string; audit_off_at: string };
export type GeneralAuditData = {
  ready: boolean;
  session: { id: string; started_at: string } | null;
  orders: GeneralAuditOrder[];
  off: OffOrder[];
  lastFinished: { finished_at: string; off_count: number } | null;
};

const FIELDS = "id,number,external_order_id,client_name,seller_name,status";

/** Situação da auditoria geral: OS anotadas, bipadas e as que estão em off. */
export async function loadGeneralAudit(): Promise<GeneralAuditData> {
  const { supabase } = await requireProfile();
  const [open, last] = await Promise.all([
    supabase.from("audit_sessions").select("id,started_at").is("finished_at", null).maybeSingle(),
    supabase.from("audit_sessions").select("finished_at,off_count").not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(1),
  ]);
  if (open.error) return { ready: false, session: null, orders: [], off: [], lastFinished: null };
  const offQuery = await supabase.from("orders_enriched_all").select(`${FIELDS},audit_off_at`).not("audit_off_at", "is", null).order("audit_off_at", { ascending: false }).limit(2000);
  const off = (offQuery.data ?? []) as OffOrder[];
  const lastFinished = (last.data?.[0] as GeneralAuditData["lastFinished"]) ?? null;
  if (!open.data) return { ready: true, session: null, orders: [], off, lastFinished };

  const marks: { order_id: string; found_at: string | null; found_position: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("audit_session_orders").select("order_id,found_at,found_position").eq("session_id", open.data.id).range(from, from + 999);
    if (error) throw new Error("Não foi possível carregar a auditoria geral. Atualize a página.");
    marks.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const byId = new Map(marks.map((mark) => [mark.order_id, mark]));
  const orders: GeneralAuditOrder[] = [];
  const ids = [...byId.keys()];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase.from("orders_enriched_all").select(FIELDS).in("id", ids.slice(i, i + 150));
    if (error) throw new Error("Não foi possível carregar as OS da auditoria. Atualize a página.");
    for (const row of data ?? []) {
      const mark = byId.get(row.id as string);
      orders.push({ ...(row as Omit<GeneralAuditOrder, "found_at" | "found_position">), found_at: mark?.found_at ?? null, found_position: mark?.found_position ?? null });
    }
  }
  return { ready: true, session: open.data, orders, off, lastFinished };
}
