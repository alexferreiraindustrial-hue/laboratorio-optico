import Link from "next/link";
import { notFound } from "next/navigation";
import { MovementForm } from "@/components/movement-form";
import { QrCard } from "@/components/qr-card";
import { PageHeading } from "@/components/shell";
import { Panel } from "@/components/ui";
import { MOVEMENT_LABEL, type MovementType } from "@/lib/domain/constants";
import { stockTone } from "@/lib/domain/stock";
import { formatBRLFromCents, formatDateTime, formatDiopter } from "@/lib/format";
import type { StockRow } from "@/lib/types";
import { requireProfile } from "@/server/session";

export default async function StockItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, role } = await requireProfile();
  const { data, error } = await supabase.from("lens_prescription_stock").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const item = data as StockRow;
  const movements = await supabase
    .from("stock_movements")
    .select("id, movement_type, quantity, signed_delta, balance_after, reason, created_at, exceptional, needs_review, order_id")
    .eq("stock_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const tone = stockTone(item.current_qty, item.min_qty, item.ideal_qty);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <PageHeading title={item.public_code} description="Identificador do estoque. O QR Code não contém receita nem dados de cliente.">
          <Link className="text-sm text-[#0e6b62] underline" href={`/estoque/etiquetas?ids=${item.id}`}>Imprimir etiqueta</Link>
        </PageHeading>
        <Panel className="p-4 text-sm">
          <p className="text-lg font-medium">{formatDiopter(item.sphere_cents)} / {formatDiopter(item.cylinder_cents)}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>Saldo {item.current_qty} · situação {tone}</div>
            <div>Mínimo {item.min_qty} · ideal {item.ideal_qty}</div>
            <div>Adição {formatDiopter(item.addition_cents)}</div>
            <div>Fabricante {item.manufacturer || "—"}</div>
            <div>Marca {item.brand || "—"}</div>
            <div>Material {item.material || "—"} {item.refractive_index ?? ""}</div>
            <div>Tratamento {item.treatment || "—"}</div>
            <div>Cor {item.color || "—"}</div>
            <div>Diâmetro {item.diameter_mm ?? "—"}</div>
            <div>Tipo {item.lens_type || "—"}</div>
            <div>Lote {item.lot_code || "—"}</div>
            <div>Localização {item.location || "—"}</div>
            <div>Custo {formatBRLFromCents(item.unit_cost_cents)}</div>
            <div>{item.is_special ? "Grau especial" : "Grade principal"}</div>
          </dl>
        </Panel>
        <Panel className="mt-4 p-4">
          <h2 className="font-medium">Movimentar</h2>
          <MovementForm stockId={item.id} role={role} />
        </Panel>
        <Panel className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-[#6e7c7a]">
              <tr>
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Delta</th>
                <th className="px-3 py-2">Saldo</th>
                <th className="px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {(movements.data ?? []).map((movement) => (
                <tr key={movement.id} className="border-t border-[#eef1f3]">
                  <td className="px-3 py-2">{formatDateTime(movement.created_at)}</td>
                  <td className="px-3 py-2">{MOVEMENT_LABEL[movement.movement_type as MovementType]} {movement.exceptional ? "· excepcional" : ""} {movement.needs_review ? "· conferir" : ""}</td>
                  <td className="px-3 py-2">{movement.signed_delta}</td>
                  <td className="px-3 py-2">{movement.balance_after}</td>
                  <td className="px-3 py-2">{movement.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <QrCard code={item.public_code} />
    </div>
  );
}
