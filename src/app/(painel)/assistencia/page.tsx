import {AssistanceEntry} from "@/components/assistance-entry";
import {STATUS_LABEL,type OrderStatus} from "@/lib/domain/constants";
import {formatDateTime} from "@/lib/format";
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
  const assistance=await supabase.from("service_orders").select("id,number,client_name,assistance_kind,assistance_origin_order_id,status,due_at").not("assistance_kind","is",null).not("status","in","(entregue,cancelado)").order("due_at",{ascending:true,nullsFirst:false}).limit(200);
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
        title="Assistência e garantias"
        description="Garantias, refações e alterações de prescrição com acompanhamento separado da OS original. As ocorrências da montagem continuam disponíveis abaixo."
      >
        <Button variant="secondary" asChild>
          <Link href="/montagem">
            <Wrench size={16} /> Ir para a bancada
          </Link>
        </Button>
      </PageHeading>
      {can(role,"orders.write")&&<AssistanceEntry/>}
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]"><h2 className="px-4 py-3 text-sm font-semibold">Assistências em andamento · {assistance.data?.length??0}</h2>{assistance.error?<p role="alert" className="px-4 pb-4 text-sm text-[var(--danger)]">Não foi possível carregar as assistências. Atualize a tela.</p>:!assistance.data?.length?<p className="px-4 pb-4 text-sm text-[var(--muted)]">Nenhuma assistência em andamento.</p>:<ul className="divide-y divide-[var(--line)]">{assistance.data.map(item=><li key={item.id}><Link href={`/laboratorio/${item.id}`} className="grid min-h-14 gap-1 px-4 py-3 text-sm hover:bg-[var(--background)] sm:grid-cols-[1fr_1fr_auto]"><span><strong>{item.client_name}</strong><span className="ml-2 font-mono text-xs text-[var(--muted)]">{item.number}</span></span><span className="text-[var(--muted)]">{item.assistance_kind} · {STATUS_LABEL[item.status as OrderStatus]}</span><time className="text-xs">{formatDateTime(item.due_at)}</time></Link></li>)}</ul>}</section>
      <h2 className="text-base font-semibold">Ocorrências da montagem · BO</h2>
      {error ? <p className="rounded-lg border border-[var(--edge-f3c9c4)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Óculos em BO" value={String(rows.length)} tone={rows.length ? "warn" : "ok"} hint="ocorrências abertas" tool="BO" />
        <Kpi label="Falta avisar" value={String(stages.filter((stage) => stage === "avisar").length)} tone={stages.includes("avisar") ? "bad" : "ok"} hint="ninguém foi avisado ainda" tool="Avisar" />
        <Kpi label="Parados há mais de 24 h" value={String(waiting)} tone={waiting ? "bad" : "ok"} hint="sem decisão do vendedor/gestor" tool="Cobrar" />
        <Kpi label="Ocorrências em 30 dias" value={String(month.length)} hint="base da análise mensal" tool="Pareto" />
      </div>

      <BoBoard rows={rows} canManage={["admin", "gestor", "montador"].includes(role)} canCancel={can(role, "orders.cancel")} nowMs={nowMs} />

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold">Onde os defeitos nascem · últimos 30 dias</h2>
            <p className="text-xs text-[var(--muted)]">Cada ocorrência é registrada na etapa em que aconteceu. É a base da reunião mensal de melhoria contínua.</p>
          </div>
          <Link href="/melhoria/indicadores" className="text-[13px] font-semibold text-[var(--link)] hover:underline">
            Ver Pareto completo
          </Link>
        </div>
        <ul className="mt-4 grid gap-2.5">
          {[...byStep, ...(noStep ? [{ key: "sem", label: "Sem etapa informada", count: noStep }] : [])].map((item) => (
            <li key={item.key} className="grid grid-cols-[170px_1fr_40px] items-center gap-3 text-sm">
              <span className="truncate font-medium">{item.label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                <span className="block h-full rounded-full bg-[var(--danger-solid)] transition-[width] duration-500" style={{ width: `${(item.count / max) * 100}%`, opacity: item.count === max ? 1 : 0.55 }} />
              </span>
              <span className="tabular text-right font-semibold">{item.count}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
