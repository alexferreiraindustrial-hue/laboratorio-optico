import Link from "next/link";
import { PageHeading } from "@/components/shell";
import { Button, Panel } from "@/components/ui";
import { requireProfile } from "@/server/session";

export default async function SellersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { supabase } = await requireProfile();
  const term = q.replace(/[%_,]/g, " ").trim();
  let query = supabase.from("sellers").select("id, public_code, name, phone, active").order("name");
  if (term) query = query.or(`name.ilike.%${term}%,public_code.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data: sellers } = await query;
  const { data: links } = await supabase.from("seller_stores").select("seller_id, stores(trade_name)");

  return (
    <div>
      <PageHeading title="Vendedores" description="Um vendedor pode atender mais de uma loja. Desativar preserva as ordens anteriores.">
        <Button asChild><Link href="/vendedores/novo">Novo vendedor</Link></Button>
      </PageHeading>
      <Panel className="mb-4 p-3">
        <form><input name="q" defaultValue={q} placeholder="Nome, código ou telefone" className="h-9 w-full rounded-md border border-[#cdd5d8] px-3 text-sm" /></form>
      </Panel>
      <div className="overflow-x-auto rounded-md border border-[#e2e7e9] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[#f7f9f9] text-[#6e7c7a]">
            <tr>
              <th className="px-3 py-2 font-medium">Vendedor</th>
              <th className="px-3 py-2 font-medium">Lojas</th>
              <th className="px-3 py-2 font-medium">Telefone</th>
              <th className="px-3 py-2 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {(sellers ?? []).map((seller) => {
              const names = (links ?? [])
                .filter((link) => link.seller_id === seller.id)
                .map((link) => {
                  const store = link.stores as { trade_name?: string } | { trade_name?: string }[] | null;
                  return Array.isArray(store) ? store[0]?.trade_name : store?.trade_name;
                })
                .filter(Boolean);
              return (
                <tr key={seller.id} className="border-t border-[#e2e7e9]">
                  <td className="px-3 py-2"><Link className="font-medium text-[#0e6b62]" href={`/vendedores/${seller.id}`}>{seller.name}</Link><div className="font-mono text-xs text-[#6e7c7a]">{seller.public_code}</div></td>
                  <td className="px-3 py-2">{names.join(", ") || "—"}</td>
                  <td className="px-3 py-2">{seller.phone || "—"}</td>
                  <td className="px-3 py-2">{seller.active ? "Ativo" : "Inativo"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
