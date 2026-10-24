import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkManager } from "@/components/party-forms";
import { PageHeading } from "@/components/shell";
import { Button, Panel } from "@/components/ui";
import { can } from "@/lib/domain/permissions";
import { STATUS_LABEL, type OrderStatus } from "@/lib/domain/constants";
import { requireProfile } from "@/server/session";

export default async function SellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, role } = await requireProfile();
  const { data: seller } = await supabase.from("sellers").select("*").eq("id", id).maybeSingle();
  if (!seller) notFound();
  const [{ data: links }, { data: orders }, { data: credentials }] = await Promise.all([
    supabase.from("seller_stores").select("store_id, stores(trade_name)").eq("seller_id", id),
    supabase.from("orders_enriched").select("id, number, client_name, store_name, status").eq("seller_id", id).order("entered_at", { ascending: false }).limit(50),
    supabase.from("portal_credentials").select("id, token_prefix, revoked_at, created_at").eq("seller_id", id).order("created_at", { ascending: false }),
  ]);
  return (
    <div className="grid gap-4">
      <PageHeading title={seller.name} description={seller.public_code}>
        <Button variant="secondary" asChild><Link href={`/vendedores/${id}/editar`}>Editar</Link></Button>
        <Button variant="secondary" asChild><Link href={`/vendedores/etiquetas?ids=${id}`}>Imprimir etiqueta</Link></Button>
      </PageHeading>
      <Panel className="grid gap-2 p-4 text-sm sm:grid-cols-2">
        <p>Telefone: {seller.phone || "—"}</p>
        <p>WhatsApp: {seller.whatsapp || "—"}</p>
        <p>E-mail: {seller.email || "—"}</p>
        <p>Situação: {seller.active ? "Ativo" : "Inativo"}</p>
        {seller.notes ? <p className="sm:col-span-2">Observação interna: {seller.notes}</p> : null}
      </Panel>
      <Panel className="p-4">
        <h2 className="font-medium">Lojas</h2>
        <ul className="mt-2 text-sm">
          {(links ?? []).map((link) => {
            const store = link.stores as { trade_name?: string } | { trade_name?: string }[] | null;
            const name = Array.isArray(store) ? store[0]?.trade_name : store?.trade_name;
            return <li key={link.store_id}><Link className="text-[#0e6b62]" href={`/lojas/${link.store_id}`}>{name}</Link></li>;
          })}
        </ul>
      </Panel>
      <Panel className="p-4">
        <h2 className="font-medium">Ordens</h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {(orders ?? []).map((order) => (
            <li key={order.id}><Link className="font-mono text-[#0e6b62]" href={`/laboratorio/${order.id}`}>{order.number}</Link> · {order.client_name} · {order.store_name || "sem loja"} · {STATUS_LABEL[order.status as OrderStatus]}</li>
          ))}
        </ul>
      </Panel>
      {can(role, "portal.manage") ? (
        <Panel className="p-4">
          <h2 className="font-medium">Link de acompanhamento</h2>
          <div className="mt-3"><LinkManager subjectType="seller" subjectId={id} credentials={credentials ?? []} phone={seller.whatsapp || seller.phone} name={seller.name} /></div>
        </Panel>
      ) : null}
    </div>
  );
}
