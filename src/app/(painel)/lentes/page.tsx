import { ScanLine } from "lucide-react";
import Link from "next/link";
import { LensBoard } from "@/components/lens-board";
import { Kpi } from "@/components/lean-ui";
import { PageHeading } from "@/components/shell";
import { Button } from "@/components/ui";
import { lensRisk } from "@/lib/domain/flow";
import { can } from "@/lib/domain/permissions";
import { loadLensQueue, loadSupplierStats } from "@/server/flow";
import { requireProfile } from "@/server/session";

export default async function LentesPage() {
  const { role } = await requireProfile();
  const [{ rows, error }, stats] = await Promise.all([loadLensQueue(), loadSupplierStats()]);
  const now = new Date();
  const risks = rows.map((row) => lensRisk({ dueAt: row.due_at, lensExpectedAt: row.lens_expected_at, now }).risk);
  const late = risks.filter((risk) => risk === "lente_atrasada").length;
  const willMiss = risks.filter((risk) => risk === "vai_atrasar").length;
  const noForecast = risks.filter((risk) => risk === "sem_previsao").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        title="Lentes a chegar"
        description="OS vendidas cuja lente ainda está no laboratório externo. A lente precisa chegar com pelo menos 1 dia de folga antes do prazo prometido ao cliente para dar tempo de montar."
      >
        <Button asChild>
          <Link href="/laboratorio/rapido?modo=lentes">
            <ScanLine size={16} /> Bipar lentes que chegaram
          </Link>
        </Button>
      </PageHeading>
      {error ? (
        <p className="rounded-lg border border-[#f3c9c4] bg-[#fdecea] px-3 py-2 text-sm text-[#a3261b]">Não foi possível carregar as previsões. Verifique se a migração do fluxo de produção foi aplicada.</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Aguardando lente" value={String(rows.length)} hint="OS paradas esperando o laboratório" tool="Fila" />
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
  );
}
