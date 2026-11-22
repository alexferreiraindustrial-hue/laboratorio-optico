import { LensForecastEditor } from "@/components/lens-forecast-editor";
import { OrderDrawer } from "@/components/order-drawer";
import { OrderForm } from "@/components/order-form";
import { OrderWorkspace } from "@/components/order-workspace";
import { loadOrderDetail } from "@/server/order-detail";
import { loadCatalogs } from "@/server/queries";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { ScanLine } from "lucide-react";
import Link from "next/link";
import { LensBoard } from "@/components/lens-board";
import { Kpi } from "@/components/lean-ui";
import { PageHeading } from "@/components/shell";
import { Button } from "@/components/ui";
import {waitingForFrame} from "@/lib/domain/operations";
import { lensRisk } from "@/lib/domain/flow";
import { can } from "@/lib/domain/permissions";
import { loadLensQueue, loadSupplierStats } from "@/server/flow";
import { requireProfile } from "@/server/session";

export default async function LentesPage({ searchParams }: { searchParams: Promise<{os?:string}> }) {
  const raw = await searchParams;
  const { role } = await requireProfile();
  const [{ rows, error }, stats] = await Promise.all([loadLensQueue(), loadSupplierStats()]);
  const detail = raw.os && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(raw.os) ? await loadOrderDetail(raw.os) : null;
  const catalogs = detail && can(role,"orders.write") ? await loadCatalogs() : null;
  const now = new Date();
  const risks = rows.filter(row=>!waitingForFrame(row)).map((row) => lensRisk({ dueAt: row.due_at, lensExpectedAt: row.lens_expected_at, now }).risk);
  const late = risks.filter((risk) => risk === "lente_atrasada").length;
  const willMiss = risks.filter((risk) => risk === "vai_atrasar").length;
  const noForecast = risks.filter((risk) => risk === "sem_previsao").length;

  return (
    <>
    <div className="lab-reference-lenses flex flex-col gap-3">
      <PageHeading
        title={<>Lentes <span className="lab-reference-heading-accent">a chegar</span></>}
        description="Acompanhe os pedidos por prioridade. Ao receber a lente, envie a OS para montagem."
      >
        <Button asChild>
          <Link href="/laboratorio/rapido?modo=lentes">
            <ScanLine size={16} /> Bipar lentes que chegaram
          </Link>
        </Button>
      </PageHeading>
      {error ? (
        <p className="rounded-lg border border-[var(--edge-f3c9c4)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">Não foi possível carregar as previsões. Verifique se a migração do fluxo de produção foi aplicada.</p>
      ) : null}
      <div className="lab-lens-metrics grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Kpi label="Aguardando lente" value={String(rows.filter(row=>!waitingForFrame(row)).length)} hint="OS paradas esperando o laboratório" tool="Fila" />
        <Kpi label="Lente atrasada" value={String(late)} tone={late ? "bad" : "ok"} hint="previsão do laboratório já passou" tool="Cobrar" />
        <Kpi label="Vão estourar o prazo" value={String(willMiss)} tone={willMiss ? "bad" : "ok"} hint="avise o vendedor e renegocie" tool="Risco" />
        <Kpi
          label="Laboratório externo · 60 dias"
          value={stats.avgLeadDays == null ? "—" : `${stats.avgLeadDays.toFixed(1).replace(".", ",")} dias`}
          hint={stats.onTime == null ? `${noForecast} sem previsão informada` : `${Math.round(stats.onTime * 100)}% chegaram na data prevista`}
          tone={stats.onTime == null ? "neutral" : stats.onTime >= 0.9 ? "ok" : stats.onTime >= 0.75 ? "warn" : "bad"}
          tool="Fornecedor"
        />
      </div>
      <LensBoard rows={rows} canEdit={role !== "consulta" && role !== "estoquista"} canRelease={can(role, "orders.status") && role !== "montador"} nowIso={now.toISOString()} />
    </div>
    {detail ? <OrderDrawer key={detail.order.id} title={`OS ${visibleOrderNumber(detail.order)}`} closeHref="/lentes" detailHref={`/laboratorio/${detail.order.id}`}
      editor={catalogs ? <><OrderForm laboratories={catalogs.laboratories} sellers={catalogs.sellers} stores={catalogs.stores} sellerLinks={catalogs.sellerLinks} order={detail.order}/><LensForecastEditor orderId={detail.order.id} expectedAt={detail.order.lens_expected_at} supplierRef={detail.order.lens_supplier_ref}/></> : undefined}
      workspace={<OrderWorkspace {...detail} mode="laboratorio"/>}/> : null}
    </>
  );
}
