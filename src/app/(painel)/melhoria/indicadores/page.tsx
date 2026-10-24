import Link from "next/link";
import { ControlChart, CycleBars, FlowTrend, ParetoChart } from "@/components/lean-charts";
import { Card, Kpi, Pill, hours, num, pct } from "@/components/lean-ui";
import { STEP_LABEL, type StepKey } from "@/lib/domain/constants";
import { loadLeanMetrics } from "@/server/lean";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30, 90] as const;

const DMAIC = [
  { letter: "D", name: "Definir", text: "Problema e meta: reduzir ocorrências e atrasos." },
  { letter: "M", name: "Medir", text: "FPY, DPMO, lead time e OTD calculados das OS." },
  { letter: "A", name: "Analisar", text: "Pareto das causas e etapa gargalo." },
  { letter: "I", name: "Melhorar", text: "Kaizen com 5 Porquês e teste em pequena escala." },
  { letter: "C", name: "Controlar", text: "Carta de controle e padronização (5S)." },
];

export default async function IndicadoresPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const params = await searchParams;
  const days = PERIODS.includes(Number(params.dias) as (typeof PERIODS)[number]) ? Number(params.dias) : 30;
  const m = await loadLeanMetrics(days);
  const outPoints = m.chart.points.filter((point) => point.out);
  const bottleneck = m.cycle.rows.find((row) => row.key === m.cycle.bottleneck);
  const vital = m.pareto.filter((item) => item.vital);

  return (
    <div className="grid gap-5 animate-[pagein_.35s_ease-out]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-[#e2e7e9] bg-white p-1">
          {PERIODS.map((period) => (
            <Link
              key={period}
              href={`/melhoria/indicadores?dias=${period}`}
              scroll={false}
              className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium", period === days ? "bg-[#e4f1ef] font-semibold text-[#0a4f48]" : "text-[#44524f] hover:bg-[#f2f5f5]")}
            >
              {period} dias
            </Link>
          ))}
        </div>
        <p className="text-xs text-[#6e7c7a]">
          {m.completed} OS prontas · {m.entered} OS recebidas · {m.defects} ocorrências no período
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-5">
        {DMAIC.map((step, index) => (
          <li key={step.letter} className="relative flex gap-2.5 rounded-xl border border-[#e2e7e9] bg-white p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: ["#0e6b62", "#1e4d9b", "#c8881a", "#5a3d86", "#1c6b43"][index] }}>
              {step.letter}
            </span>
            <span className="flex flex-col">
              <span className="text-[13px] font-semibold">{step.name}</span>
              <span className="text-xs leading-snug text-[#6e7c7a]">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Nível sigma"
          value={m.sigma == null ? "—" : `${num(m.sigma, 2)}σ`}
          badge={m.dpmo == null ? undefined : `${m.dpmo.toLocaleString("pt-BR")} DPMO`}
          tone={m.sigma == null ? "neutral" : m.sigma >= 4 ? "ok" : m.sigma >= 3 ? "warn" : "bad"}
          hint="5 oportunidades de defeito por OS"
          tool="6σ"
        />
        <Kpi label="FPY · aprovação de primeira" value={pct(m.fpy, 1)} tone={m.fpy == null ? "neutral" : m.fpy >= 0.95 ? "ok" : m.fpy >= 0.85 ? "warn" : "bad"} hint="OS prontas sem ocorrência" tool="Qualidade" />
        <Kpi label="OTD · entrega no prazo" value={pct(m.otd, 1)} tone={m.otd == null ? "neutral" : m.otd >= 0.95 ? "ok" : m.otd >= 0.85 ? "warn" : "bad"} hint="pronto até o prazo combinado" tool="Lean" />
        <Kpi label="Lead time (mediana)" value={hours(m.leadTimeMedianH)} hint={`média ${hours(m.leadTimeMeanH)} · P90 ${hours(m.leadTimeP90H)}`} tool="Fluxo" />
        <Kpi label="Throughput" value={`${num(m.throughput)} OS/dia`} hint="vazão média em dias com produção" tool="Fluxo" />
        <Kpi label="WIP · em processo" value={String(m.wip)} hint={m.littleDays == null ? "sem vazão no período" : `Lei de Little: ${num(m.littleDays)} dias de fila`} tool="Kanban" />
        <Kpi label="Takt time" value={m.takt == null ? "—" : `${num(m.takt, 0)} min`} hint={`${m.availableMinutes} min ÷ ${num(m.demandPerDay)} OS/dia de demanda`} tool="Lean" />
        <Kpi label="Ocorrências em aberto" value={String(m.openDefects)} tone={m.openDefects === 0 ? "ok" : m.openDefects <= 3 ? "warn" : "bad"} hint={`${m.defects} registradas no período`} tool="Qualidade" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="Pareto das ocorrências"
          subtitle="Princípio 80/20: as barras escuras são os poucos vitais que concentram a maior parte dos defeitos"
          action={vital.length ? <Pill tone="bad">{vital.length} causas = {pct(vital[vital.length - 1].cumulative)}</Pill> : undefined}
        >
          {m.pareto.length ? <ParetoChart data={m.pareto} /> : <p className="py-16 text-center text-sm text-[#6e7c7a]">Nenhuma ocorrência no período.</p>}
        </Card>

        <Card
          title="Carta de controle u · defeitos por OS"
          subtitle="Média ± 3 desvios. Pontos vermelhos estão fora de controle: investigue a causa especial daquele dia"
          action={<Pill tone={outPoints.length ? "bad" : "ok"}>{outPoints.length ? `${outPoints.length} fora de controle` : "Processo sob controle"}</Pill>}
        >
          {m.chart.points.length ? <ControlChart data={m.chart.points} /> : <p className="py-16 text-center text-sm text-[#6e7c7a]">Sem OS prontas no período.</p>}
        </Card>

        <Card
          title="Tempo de ciclo por etapa e gargalo"
          subtitle="Teoria das Restrições: a etapa mais lenta (em vermelho) define a vazão do laboratório"
          action={bottleneck ? <Pill tone="warn">Gargalo: {STEP_LABEL[bottleneck.key as StepKey]}</Pill> : undefined}
        >
          <CycleBars data={m.cycle.rows} takt={m.takt} bottleneck={m.cycle.bottleneck} />
          <p className="mt-2 text-xs text-[#6e7c7a]">
            Medido do início à conclusão de cada etapa na bancada ({m.cycle.rows.reduce((sum, row) => sum + row.samples, 0)} registros). A linha tracejada é o takt time.
          </p>
        </Card>

        <Card title="Produção × ocorrências por dia" subtitle="Vazão diária comparada aos defeitos registrados">
          <FlowTrend data={m.trend} />
        </Card>
      </div>
    </div>
  );
}
