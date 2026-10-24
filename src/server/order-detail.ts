import { notFound } from "next/navigation";
import type { OccurrenceRow, OrderRow, StepRow } from "@/lib/types";
import { requireProfile } from "./session";

export type OrderMessage = {
  id: string;
  sender_label: string;
  body: string;
  status: string;
  created_at: string;
  reply_body: string | null;
  replied_at: string | null;
};

export async function loadOrderDetail(id: string) {
  const { supabase, role } = await requireProfile();
  const { data: order, error } = await supabase.from("orders_enriched").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) notFound();

  const [seller, messages] = await Promise.all([
    order.seller_id
      ? supabase.from("sellers").select("id, name, phone, whatsapp").eq("id", order.seller_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("order_messages")
      .select("id, sender_label, body, status, created_at, reply_body, replied_at")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const [history, steps, occurrences, categories, profiles, movements] = await Promise.all([
    supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("assembly_steps").select("*").eq("order_id", id),
    supabase.from("quality_occurrences").select("*, quality_categories(name)").eq("order_id", id).order("occurred_at", { ascending: false }),
    supabase.from("quality_categories").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("stock_movements").select("id, movement_type, quantity, signed_delta, reason, created_at, lens_prescription_stock(public_code)").eq("order_id", id).order("created_at", { ascending: false }),
  ]);

  const stepRows = (steps.data ?? []) as StepRow[];
  const occurrenceRows = (occurrences.data ?? []).map((item) => {
    const category = item.quality_categories as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(category) ? category[0]?.name : category?.name;
    return { ...item, category_name: name ?? "Categoria" } as OccurrenceRow;
  });
  const names = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.full_name]));
  const entityIds = [id, ...stepRows.map((step) => step.id), ...occurrenceRows.map((item) => item.id)];
  const attachmentQuery = await supabase.from("attachments").select("*").in("entity_id", entityIds).is("deleted_at", null);
  const paths = (attachmentQuery.data ?? []).map((item) => item.storage_path as string);
  const signed = paths.length
    ? await supabase.storage.from("lab-files").createSignedUrls(paths, 60 * 30)
    : { data: [] };
  const urlByPath = new Map((signed.data ?? []).map((item) => [item.path, item.signedUrl]));

  return {
    role,
    seller: (seller.data ?? null) as { id: string; name: string; phone: string | null; whatsapp: string | null } | null,
    messages: (messages.data ?? []) as OrderMessage[],
    order: order as OrderRow,
    steps: stepRows,
    history: (history.data ?? []).map((item) => ({
      ...item,
      user_name: item.user_id ? names.get(item.user_id) : undefined,
    })),
    occurrences: occurrenceRows,
    categories: categories.data ?? [],
    attachments: (attachmentQuery.data ?? []).map((item) => ({
      ...item,
      url: urlByPath.get(item.storage_path) ?? undefined,
    })),
    movements: (movements.data ?? []).map((item) => {
      const stock = item.lens_prescription_stock as { public_code?: string } | { public_code?: string }[] | null;
      const code = Array.isArray(stock) ? stock[0]?.public_code : stock?.public_code;
      return { ...item, public_code: code };
    }),
  };
}
