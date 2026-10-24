import { Inbox } from "@/components/inbox";
import { PageHeading } from "@/components/shell";
import { requireProfile } from "@/server/session";
import { viewMessage } from "@/server/parties";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string }>;
}) {
  const filters = await searchParams;
  const { supabase } = await requireProfile();
  let query = supabase
    .from("order_messages")
    .select("id, order_id, sender_label, body, status, created_at, reply_body, store_id, seller_id")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00-03:00`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59-03:00`);
  const { data } = await query;
  const orderIds = [...new Set((data ?? []).map((item) => item.order_id))];
  const { data: orders } = orderIds.length
    ? await supabase.from("orders_enriched").select("id, number, store_name, seller_name, store_id, seller_id").in("id", orderIds)
    : { data: [] };
  const byOrder = new Map((orders ?? []).map((order) => [order.id, order]));
  const term = (filters.q ?? "").toLocaleLowerCase("pt-BR");
  const items = (data ?? [])
    .map((item) => {
      const order = byOrder.get(item.order_id);
      return {
        ...item,
        order_number: order?.number,
        store_name: order?.store_name,
        seller_name: order?.seller_name,
      };
    })
    .filter((item) => {
      if (!term) return true;
      return [item.body, item.sender_label, item.order_number, item.store_name, item.seller_name]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(term));
    });

  await Promise.all(items.filter((item) => item.status === "novo").map((item) => viewMessage(item.id)));

  return (
    <div>
      <PageHeading title="Recados" description="Mensagens do portal externo. Um recado não altera o status da OS." />
      <Inbox items={items} filters={filters} />
    </div>
  );
}
