import { RoutineBoard } from "@/components/routine-board";
import { PageHeading } from "@/components/shell";
import { dayRange } from "@/lib/domain/calendar";
import { loadRoutine } from "@/server/flow";
import { requireProfile } from "@/server/session";

const longDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" });

export default async function RotinaPage() {
  const { supabase, role } = await requireProfile();
  const range = dayRange(new Date());
  const from = range.start.toISOString();
  const to = range.end.toISOString();
  const count = (query: PromiseLike<{ count: number | null }>) => query.then((result) => result.count ?? 0);
  const [{ logs, error }, entered, released, ready, bo] = await Promise.all([
    loadRoutine(),
    count(supabase.from("service_orders").select("id", { count: "exact", head: true }).gte("entered_at", from).lt("entered_at", to)),
    count(supabase.from("service_orders").select("id", { count: "exact", head: true }).gte("lens_arrived_at", from).lt("lens_arrived_at", to)),
    count(supabase.from("service_orders").select("id", { count: "exact", head: true }).gte("completed_at", from).lt("completed_at", to)),
    count(supabase.from("quality_occurrences").select("id", { count: "exact", head: true }).in("status", ["aberta", "em_tratamento"])),
  ]);
  const today = longDate.format(new Date());

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        title="Rotina do dia"
        description={`${today.charAt(0).toUpperCase()}${today.slice(1)} · checklist de abertura e fechamento, chegadas do motoboy com as lentes e anotações do turno.`}
      />
      {error ? (
        <p className="rounded-lg border border-[#f3c9c4] bg-[#fdecea] px-3 py-2 text-sm text-[#a3261b]">A rotina ainda não foi ativada no banco. Execute a migração do fluxo de produção no Supabase.</p>
      ) : null}
      <RoutineBoard
        logs={logs}
        canEdit={role !== "consulta"}
        stats={[
          { label: "OS lançadas hoje", value: entered, href: "/laboratorio" },
          { label: "Lentes liberadas hoje", value: released, href: "/montagem" },
          { label: "Prontas hoje", value: ready, href: "/laboratorio?tab=prontas" },
          { label: "Óculos em BO", value: bo, href: "/assistencia" },
        ]}
      />
    </div>
  );
}
