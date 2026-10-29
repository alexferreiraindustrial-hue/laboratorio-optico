import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkManager } from "@/components/party-forms";
import { PageHeading } from "@/components/shell";
import { Button, Panel } from "@/components/ui";
import { STATUS_LABEL, type OrderStatus } from "@/lib/domain/constants";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { formatDateTime } from "@/lib/format";
import { requireProfile } from "@/server/session";
import { can } from "@/lib/domain/permissions";

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, role } = await requireProfile();
  const { data: store } = await supabase.from("stores").select("*").eq("id", id).maybeSingle();
  if (!store) notFound();
  const [{ data: links }, { data: orders }, { data: credentials }] = await Promise.all([
    supabase.from("seller_stores").select("seller_id, sellers(name, active, public_code)").eq("store_id", id),
    supabase.from("orders_enriched").select("id, number, external_order_id, client_name, seller_name, status, entered_at").eq("store_id", id).order("entered_at", { ascending: false }).limit(50),
    supabase.from("portal_credentials").select("id, token_prefix, revoked_at, created_at").eq("store_id", id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="grid gap-4">
      <PageHeading title={store.trade_name} description={store.public_code}>
        <Button variant="secondary" asChild><Link href={`/lojas/${id}/editar`}>Editar</Link></Button>
        <Button variant="secondary" asChild><Link href={`/lojas/etiquetas?ids=${id}`}>Imprimir etiqueta</Link></Button>
      </PageHeading>
      <Panel className="grid gap-2 p-4 text-sm sm:grid-cols-2">
        <p>Responsável: {store.contact_name || "—"}</p>
        <p>Telefone: {store.phone || "—"}</p>
        <p>WhatsApp: {store.whatsapp || "—"}</p>
        <p>E-mail: {store.email || "—"}</p>
        <p>CNPJ: {store.cnpj || "—"}</p>
        <p>Situação: {store.active ? "Ativa" : "Inativa"}</p>
        <p className="sm:col-span-2">Endereço: {store.address || "—"}</p>
        {store.notes ? <p className="sm:col-span-2">Observação interna: {store.notes}</p> : null}
      </Panel>
      <Panel className="p-4">
        <h2 className="font-medium">Vendedores</h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {(links ?? []).map((link) => {
            const seller = link.sellers as { name?: string; active?: boolean; public_code?: string } | { name?: string; active?: boolean; public_code?: string }[] | null;
            const row = Array.isArray(seller) ? seller[0] : seller;
            return <li key={link.seller_id}><Link className="text-[#0e6b62]" href={`/vendedores/${link.seller_id}`}>{row?.name}</Link> · {row?.public_code} · {row?.active ? "ativo" : "inativo"}</li>;
          })}
          {(links ?? []).length === 0 ? <li className="text-[#6e7c7a]">Nenhum vendedor vinculado.</li> : null}
        </ul>
      </Panel>
      <Panel className="p-4">
        <h2 className="font-medium">Ordens</h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {(orders ?? []).map((order) => (
            <li key={order.id}><Link className="font-mono text-[#0e6b62]" href={`/laboratorio/${order.id}`}>{visibleOrderNumber(order)}</Link> · {order.client_name} · {order.seller_name || "sem vendedor"} · {STATUS_LABEL[order.status as OrderStatus]} · {formatDateTime(order.entered_at)}</li>
          ))}
          {(orders ?? []).length === 0 ? <li className="text-[#6e7c7a]">Nenhuma OS desta loja.</li> : null}
        </ul>
      </Panel>
      {can(role, "portal.manage") ? (
        <Panel className="p-4">
          <h2 className="font-medium">Link de acompanhamento</h2>
          <div className="mt-3"><LinkManager subjectType="store" subjectId={id} credentials={credentials ?? []} /></div>
        </Panel>
      ) : null}
    </div>
  );
}
