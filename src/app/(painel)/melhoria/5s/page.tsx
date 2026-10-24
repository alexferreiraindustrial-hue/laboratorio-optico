import { Suspense } from "react";
import { FiveSPanel } from "@/components/five-s";
import { Kpi, pct } from "@/components/lean-ui";
import { fiveSLevel } from "@/lib/domain/lean";
import { loadAudits, summarizeAudits } from "@/server/lean";
import { requireProfile } from "@/server/session";

export default async function FiveSPage() {
  const { role } = await requireProfile();
  const { audits, error } = await loadAudits();
  const summary = summarizeAudits(audits);
  const sorted = [...summary.areas].sort((a, b) => b.percent - a.percent);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const monthAgo = new Date().getTime() - 30 * 864e5;
  const recent = audits.filter((audit) => new Date(audit.audited_at).getTime() >= monthAgo).length;
  const level = summary.overall == null ? null : fiveSLevel(summary.overall);

  return (
    <div className="grid gap-5">
      {error ? (
        <p className="rounded-lg border border-[#f3c9c4] bg-[#fdecea] px-3 py-2 text-sm text-[#a3261b]">
          O módulo 5S ainda não foi ativado no banco de dados. Execute a migração de melhoria contínua no Supabase.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Índice 5S do laboratório" value={pct(summary.overall)} badge={level?.label} tone={level?.tone ?? "neutral"} hint="média da última auditoria de cada área" tool="5S" />
        <Kpi label="Melhor área" value={best ? pct(best.percent) : "—"} hint={best?.area ?? "sem auditorias"} tone={best ? "ok" : "neutral"} tool="Referência" />
        <Kpi label="Área que mais precisa" value={worst ? pct(worst.percent) : "—"} hint={worst?.area ?? "sem auditorias"} tone={worst ? fiveSLevel(worst.percent).tone : "neutral"} tool="Foco" />
        <Kpi label="Auditorias em 30 dias" value={String(recent)} hint="recomendado: 1 por área por semana" tone={recent >= summary.areas.length * 2 ? "ok" : "warn"} tool="Disciplina" />
      </div>
      <Suspense>
        <FiveSPanel areas={summary.areas} audits={audits} canWrite={role !== "consulta"} />
      </Suspense>
    </div>
  );
}
