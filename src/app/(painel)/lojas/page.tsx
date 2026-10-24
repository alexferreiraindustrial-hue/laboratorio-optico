import Link from "next/link";
import { PageHeading } from "@/components/shell";
import { Button, Panel } from "@/components/ui";
import { requireProfile } from "@/server/session";

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { supabase } = await requireProfile();
  const term = q.trim();
  let query = supabase.from("stores").select("id, public_code, trade_name, contact_name, phone, active").order("trade_name");
  if (term) {
    query = query.or(`trade_name.ilike.%${term.replace(/[%_,]/g, " ")}%,public_code.ilike.%${term.replace(/[%_,]/g, " ")}%,contact_name.ilike.%${term.replace(/[%_,]/g, " ")}%,phone.ilike.%${term.replace(/[%_,]/g, " ")}%`);
  }
  const [{ data: stores }, { data: orders }] = await Promise.all([
    query,
    supabase.from("service_orders").select("store_id, status, due_at"),
  ]);
  const now = new Date().getTime();
  const stats = new Map<string, { open: number; ready: number; late: number }>();
  for (const order of orders ?? []) {
    if (!order.store_id) continue;
    const current = stats.get(order.store_id) ?? { open: 0, ready: 0, late: 0 };
    const closed = order.status === "entregue" || order.status === "cancelado";
    if (!closed && order.status !== "pronto") current.open += 1;
    if (order.status === "pronto") current.ready += 1;
    if (!closed && order.due_at && new Date(order.due_at).getTime() < now) current.late += 1;
    stats.set(order.store_id, current);
  }

  return (
    <div>
      <PageHeading title="Lojas" description="Óticas atendidas pelo laboratório. Uma loja com histórico é desativada, não excluída.">
        <Button asChild><Link href="/lojas/nova">Nova loja</Link></Button>
      </PageHeading>
      <Panel className="mb-4 p-3">
        <form>
          <input name="q" defaultValue={q} placeholder="Nome, código, responsável ou telefone" className="h-9 w-full rounded-md border border-[#cdd5d8] px-3 text-sm" />
        </form>
      </Panel>
      <div className="overflow-x-auto rounded-md border border-[#e2e7e9] bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[#f7f9f9] text-[#6e7c7a]">
            <tr>
              <th className="px-3 py-2 font-medium">Loja</th>
              <th className="px-3 py-2 font-medium">Responsável</th>
              <th className="px-3 py-2 font-medium">Telefone</th>
              <th className="px-3 py-2 font-medium">Em andamento</th>
              <th className="px-3 py-2 font-medium">Prontas</th>
              <th className="px-3 py-2 font-medium">Atrasadas</th>
              <th className="px-3 py-2 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {(stores ?? []).map((store) => {
              const item = stats.get(store.id) ?? { open: 0, ready: 0, late: 0 };
              return (
                <tr key={store.id} className="border-t border-[#e2e7e9]">
                  <td className="px-3 py-2"><Link className="font-medium text-[#0e6b62]" href={`/lojas/${store.id}`}>{store.trade_name}</Link><div className="font-mono text-xs text-[#6e7c7a]">{store.public_code}</div></td>
                  <td className="px-3 py-2">{store.contact_name || "—"}</td>
                  <td className="px-3 py-2">{store.phone || "—"}</td>
                  <td className="px-3 py-2">{item.open}</td>
                  <td className="px-3 py-2">{item.ready}</td>
                  <td className="px-3 py-2">{item.late}</td>
                  <td className="px-3 py-2">{store.active ? "Ativa" : "Inativa"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
