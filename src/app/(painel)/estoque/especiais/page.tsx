import Link from "next/link";
import { StockCreateForm } from "@/components/stock-board";
import { PageHeading } from "@/components/shell";
import { Button, EmptyState, Panel } from "@/components/ui";
import { DEFAULT_GRID, isSpecialPower, type GridConfig } from "@/lib/domain/powers";
import { can } from "@/lib/domain/permissions";
import { formatDiopter } from "@/lib/format";
import { stockTone } from "@/lib/domain/stock";
import type { StockRow } from "@/lib/types";
import { loadCatalogs } from "@/server/queries";
import { requireProfile } from "@/server/session";

export default async function SpecialStockPage() {
  const { supabase, role } = await requireProfile();
  const [{ settings }, stock] = await Promise.all([
    loadCatalogs(),
    supabase.from("lens_prescription_stock").select("*").eq("active", true),
  ]);
  const gridValue = settings.stock_grid ?? {};
  const grid: GridConfig = {
    sphereMinCents: Number(gridValue.sphere_min_cents ?? DEFAULT_GRID.sphereMinCents),
    sphereMaxCents: Number(gridValue.sphere_max_cents ?? DEFAULT_GRID.sphereMaxCents),
    cylinderMinCents: Number(gridValue.cylinder_min_cents ?? DEFAULT_GRID.cylinderMinCents),
    cylinderMaxCents: Number(gridValue.cylinder_max_cents ?? DEFAULT_GRID.cylinderMaxCents),
    stepCents: Number(gridValue.step_cents ?? DEFAULT_GRID.stepCents),
  };
  const { data, error } = stock;
  const items = ((data ?? []) as StockRow[]).filter((item) =>
    isSpecialPower(item.sphere_cents, item.cylinder_cents, grid, item.is_special),
  );

  return (
    <div>
      <PageHeading title="Graus especiais" description="Combinações fora da grade principal, com as mesmas movimentações, mínimo e QR Code.">
        <Button variant="secondary" asChild><Link href="/estoque">Voltar à grade</Link></Button>
      </PageHeading>
      {error ? <p className="text-sm text-[#b42318]">{error.message}</p> : null}
      {items.length === 0 ? (
        <EmptyState title="Nenhum grau especial" text="Cadastre abaixo quando a receita ficar fora da faixa configurada." />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-[#6e7c7a]">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Grau</th>
                <th className="px-3 py-2">Saldo</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Local</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[#eef1f3]">
                  <td className="px-3 py-2"><Link className="text-[#0e6b62] underline" href={`/estoque/${item.id}`}>{item.public_code}</Link></td>
                  <td className="px-3 py-2">{formatDiopter(item.sphere_cents)} / {formatDiopter(item.cylinder_cents)}</td>
                  <td className="px-3 py-2">{item.current_qty}</td>
                  <td className="px-3 py-2">{stockTone(item.current_qty, item.min_qty, item.ideal_qty)}</td>
                  <td className="px-3 py-2">{item.location || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      {can(role, "stock.write") ? (
        <Panel className="mt-4 p-4">
          <h2 className="font-medium">Cadastrar grau especial</h2>
          <StockCreateForm isSpecial />
        </Panel>
      ) : null}
    </div>
  );
}
