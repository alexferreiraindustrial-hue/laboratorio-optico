import { Wrench } from "lucide-react";
import Link from "next/link";
import { BoBoard } from "@/components/bo-board";
import { Kpi } from "@/components/lean-ui";
import { PageHeading } from "@/components/shell";
import { Button } from "@/components/ui";
import { STEP_KEYS, STEP_LABEL } from "@/lib/domain/constants";
import { boStage } from "@/lib/domain/flow";
import { can } from "@/lib/domain/permissions";
import { loadBo } from "@/server/flow";
import { requireProfile } from "@/server/session";

export default async function AssistenciaPage() {
  const { supabase, role } = await requireProfile();
  const nowMs = new Date().getTime();
  const since = new Date(nowMs - 30 * 864e5).toISOString();
  const [{ rows, error }, monthResult] = await Promise.all([
    loadBo(),
    supabase.from("quality_occurrences").select("step_key, status").gte("occurred_at", since).neq("status", "dispensada"),
  ]);
  const stages = rows.map((row) => boStage(row));
  const waiting = rows.filter((row) => boStage(row) !== "em_tratamento" && nowMs - new Date(row.notified_at ?? row.occurred_at).getTime() > 24 * 36e5).length;
  const month = monthResult.data ?? [];
  const byStep = STEP_KEYS.map((key) => ({ key, label: STEP_LABEL[key], count: month.filter((item) => item.step_key === key).length }));
  const noStep = month.filter((item) => !item.step_key).length;
  const max = Math.max(1, ...byStep.map((item) => item.count), noStep);

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        title="Assistência · BO"
        description="Óculos barrados na bancada por algum problema. Separe, avise o vendedor ou o gestor, registre a decisão (nova lente, refazer, reparo) e conclua quando voltar ao fluxo."
      >
        <Button variant="secondary" asChild>
          <Link href="/montagem">
            <Wrench size={16} /> Ir para a bancada
          </Link>
        </Button>
      </PageHeading>
      {error ? <p className="rounded-lg border border-[#f3c9c4] bg-[#fdecea] px-3 py-2 text-sm text-[#a3261b]">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Óculos em BO" value={String(rows.length)} tone={rows.length ? "warn" : "ok"} hint="ocorrências abertas" tool="BO" />
        <Kpi label="Falta avisar" value={String(stages.filter((stage) => stage === "avisar").length)} tone={stages.includes("avisar") ? "bad" : "ok"} hint="ninguém foi avisado ainda" tool="Avisar" />
        <Kpi label="Parados há mais de 24 h" value={String(waiting)} tone={waiting ? "bad" : "ok"} hint="sem decisão do vendedor/gestor" tool="Cobrar" />
        <Kpi label="Ocorrências em 30 dias" value={String(month.length)} hint="base da análise mensal" tool="Pareto" />
      </div>

      <BoBoard rows={rows} canManage={["admin", "gestor", "montador"].includes(role)} canCancel={can(role, "orders.cancel")} nowMs={nowMs} />

      <section className="rounded-xl border border-[#e2e7e9] bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold">Onde os defeitos nascem · últimos 30 dias</h2>
            <p className="text-xs text-[#6e7c7a]">Cada ocorrência é registrada na etapa em que aconteceu. É a base da reunião mensal de melhoria contínua.</p>
          </div>
          <Link href="/melhoria/indicadores" className="text-[13px] font-semibold text-[#0e6b62] hover:underline">
            Ver Pareto completo
          </Link>
        </div>
        <ul className="mt-4 grid gap-2.5">
          {[...byStep, ...(noStep ? [{ key: "sem", label: "Sem etapa informada", count: noStep }] : [])].map((item) => (
            <li key={item.key} className="grid grid-cols-[170px_1fr_40px] items-center gap-3 text-sm">
              <span className="truncate font-medium">{item.label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-[#eef1f3]">
                <span className="block h-full rounded-full bg-[#b42318] transition-[width] duration-500" style={{ width: `${(item.count / max) * 100}%`, opacity: item.count === max ? 1 : 0.55 }} />
              </span>
              <span className="tabular text-right font-semibold">{item.count}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
