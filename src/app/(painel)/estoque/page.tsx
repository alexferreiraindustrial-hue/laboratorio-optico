import Link from "next/link";
import { StockBoard } from "@/components/stock-board";
import { PageHeading } from "@/components/shell";
import { Button } from "@/components/ui";
import { loadCatalogs } from "@/server/queries";
import { requireProfile } from "@/server/session";
import type { StockRow } from "@/lib/types";

export default async function EstoquePage() {
  const { supabase, role } = await requireProfile();
  const [{ settings }, stock] = await Promise.all([
    loadCatalogs(),
    supabase
    .from("lens_prescription_stock")
    .select("*")
    .eq("active", true)
    .eq("is_special", false)
    .order("sphere_cents")
    .order("cylinder_cents"),
  ]);
  const { data, error } = stock;

  return (
    <div>
      <PageHeading
        title="Estoque de lentes"
        description="Clique em um grau da grade para ver o saldo ou use “Cadastrar lente” para incluir uma nova combinação. Cada combinação tem saldo e QR Code próprios."
      >
        <Button asChild><Link href="/estoque/nova">+ Cadastrar lente</Link></Button>
        <Button variant="secondary" asChild><Link href="/estoque/especiais">Graus especiais</Link></Button>
        <Button variant="secondary" asChild><Link href="/estoque/leitura">Ler QR Code</Link></Button>
      </PageHeading>
      {error ? <p className="mb-3 text-sm text-[#b42318]">{error.message}</p> : null}
      <StockBoard items={(data ?? []) as StockRow[]} gridValue={settings.stock_grid} role={role} />
    </div>
  );
}
