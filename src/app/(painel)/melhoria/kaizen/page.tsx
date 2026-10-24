import { Suspense } from "react";
import { KaizenBoard } from "@/components/kaizen-board";
import { Kpi } from "@/components/lean-ui";
import { can } from "@/lib/domain/permissions";
import { loadKaizen, loadPeople } from "@/server/lean";
import { requireProfile } from "@/server/session";

export default async function KaizenPage() {
  const { role, user } = await requireProfile();
  const [{ ideas, error }, people] = await Promise.all([loadKaizen(), loadPeople()]);
  const active = ideas.filter((idea) => idea.status !== "descartada");
  const standardized = ideas.filter((idea) => idea.status === "padronizada");
  const gain = standardized.reduce((sum, idea) => sum + (idea.gain_minutes_day ?? 0), 0);
  const participants = new Set(ideas.map((idea) => idea.created_by).filter(Boolean)).size;
  const done = standardized.filter((idea) => idea.started_at && idea.standardized_at);
  const avgDays = done.length
    ? done.reduce((sum, idea) => sum + (new Date(idea.standardized_at!).getTime() - new Date(idea.created_at).getTime()) / 864e5, 0) / done.length
    : null;

  return (
    <div className="grid gap-5">
      {error ? (
        <p className="rounded-lg border border-[#f3c9c4] bg-[#fdecea] px-3 py-2 text-sm text-[#a3261b]">
          O módulo Kaizen ainda não foi ativado no banco de dados. Execute a migração de melhoria contínua no Supabase.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ideias ativas" value={String(active.length - standardized.length)} hint="no ciclo PDCA" tool="Kaizen" />
        <Kpi label="Padronizadas" value={String(standardized.length)} tone={standardized.length ? "ok" : "neutral"} hint="viraram padrão de trabalho" tool="Act" />
        <Kpi label="Tempo devolvido" value={`${gain} min/dia`} tone={gain ? "ok" : "neutral"} hint={gain ? `≈ ${Math.round((gain * 22) / 60)} h por mês` : "registre o ganho ao padronizar"} tool="Muda" />
        <Kpi
          label="Participação"
          value={`${participants} ${participants === 1 ? "pessoa" : "pessoas"}`}
          hint={avgDays == null ? "da ideia ao padrão" : `${avgDays.toFixed(0)} dias da ideia ao padrão`}
          tool="Equipe"
        />
      </div>
      <Suspense>
        <KaizenBoard
          ideas={ideas}
          people={people.filter((person) => person.active).map(({ id, full_name }) => ({ id, full_name }))}
          canWrite={role !== "consulta"}
          canManage={can(role, "settings.write")}
          currentUser={user.id}
        />
      </Suspense>
    </div>
  );
}
