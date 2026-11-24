import { requireProfile } from "./session";
import type {
  ClientDelivery,
  ClientFollowupRow,
} from "@/lib/domain/client-followup";
export async function loadClientFollowups() {
  const { supabase, role } = await requireProfile();
  if (!["admin", "gestor"].includes(role)) return [] as ClientFollowupRow[];
  const records: ClientDelivery[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("client_delivery_followups")
      .select(
        "id,order_id,client_delivered_at,followup_due_at,client_phone,contacted_at,outcome,feedback_note,updated_at",
      )
      .order("id")
      .range(offset, offset + 499);
    if (error)
      throw new Error(
        "Não foi possível carregar o acompanhamento das entregas ao cliente.",
      );
    records.push(...(data as ClientDelivery[]));
    if (data.length < 500) break;
  }
  const names = new Map<
    string,
    {
      number: string;
      client_name: string;
      seller_name: string | null;
      seller_id: string | null;
    }
  >();
  for (let offset = 0; offset < records.length; offset += 150) {
    const { data, error } = await supabase
      .from("orders_enriched")
      .select("id,number,client_name,seller_name,seller_id")
      .in(
        "id",
        records.slice(offset, offset + 150).map((row) => row.order_id),
      );
    if (error) throw new Error("Não foi possível conferir as OS do pós-venda.");
    for (const row of data ?? []) names.set(row.id, row);
  }
  return records
    .map((row) => ({
      ...row,
      ...(names.get(row.order_id) ?? {
        number: "OS indisponível",
        client_name: "Confira a OS antes do contato",
        seller_id: null,
        seller_name: null,
      }),
    }))
    .sort((a, b) => a.followup_due_at.localeCompare(b.followup_due_at));
}
export async function loadClientDelivery(id: string) {
  const { supabase, role } = await requireProfile();
  if (!["admin", "gestor"].includes(role)) return null;
  const { data, error } = await supabase
    .from("client_delivery_followups")
    .select(
      "id,order_id,client_delivered_at,followup_due_at,client_phone,contacted_at,outcome,feedback_note,updated_at",
    )
    .eq("order_id", id)
    .maybeSingle();
  if (error)
    throw new Error(
      "Não foi possível conferir a confirmação de entrega ao cliente.",
    );
  return data as ClientDelivery | null;
}
