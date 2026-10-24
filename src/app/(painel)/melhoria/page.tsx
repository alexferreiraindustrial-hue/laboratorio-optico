import { Activity, ArrowRight, ClipboardCheck, Gauge, Lightbulb, Target, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { LeanSettingsForm } from "@/components/lean-settings-form";
import { Card, Kpi, Pill, hours, num, pct } from "@/components/lean-ui";
import { STATUS_LABEL, STEP_LABEL, type OrderStatus, type StepKey } from "@/lib/domain/constants";
import { KAIZEN_STAGES, fiveSLevel, wipState } from "@/lib/domain/lean";
import { can } from "@/lib/domain/permissions";
import { loadAudits, loadKaizen, loadLeanMetrics, summarizeAudits } from "@/server/lean";
import { requireProfile } from "@/server/session";

function sigmaTone(sigma: number | null) {
  if (sigma == null) return "neutral" as const;
  if (sigma >= 4) return "ok" as const;
  if (sigma >= 3) return "warn" as const;
  return "bad" as const;
}

function PdcaWheel({ counts }: { counts: Record<string, number> }) {
  const quadrants = [
    { key: "ideia", letter: "P", label: "Planejar", color: "#0e6b62", d: "M100 100 L100 8 A92 92 0 0 1 192 100 Z", tx: 140, ty: 62 },
    { key: "em_teste", letter: "D", label: "Executar", color: "#1e4d9b", d: "M100 100 L192 100 A92 92 0 0 1 100 192 Z", tx: 140, ty: 146 },
    { key: "verificacao", letter: "C", label: "Verificar", color: "#c8881a", d: "M100 100 L100 192 A92 92 0 0 1 8 100 Z", tx: 60, ty: 146 },
    { key: "padronizada", letter: "A", label: "Padronizar", color: "#1c6b43", d: "M100 100 L8 100 A92 92 0 0 1 100 8 Z", tx: 60, ty: 62 },
  ];
  return (
    <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="img" aria-label="Ciclo PDCA das melhorias">
      {quadrants.map((q) => (
        <g key={q.key}>
          <path d={q.d} fill={q.color} opacity={0.92} stroke="white" strokeWidth={3} />
          <text x={q.tx} y={q.ty} textAnchor="middle" fill="white" fontSize="24" fontWeight="700">
            {q.letter}
          </text>
          <text x={q.tx} y={q.ty + 18} textAnchor="middle" fill="white" fontSize="11" fontWeight="600" opacity={0.92}>
            {counts[q.key] ?? 0} {(counts[q.key] ?? 0) === 1 ? "ideia" : "ideias"}
          </text>
        </g>
      ))}
      <circle cx="100" cy="100" r="26" fill="white" />
      <text x="100" y="97" textAnchor="middle" fontSize="10" fill="#6e7c7a" fontWeight="600">
        KAIZEN
      </text>
      <text x="100" y="111" textAnchor="middle" fontSize="9" fill="#8a9694">
        PDCA
      </text>
    </svg>
  );
}

export default async function MelhoriaPage() {
  const { role } = await requireProfile();
  const [metrics, kaizen, auditsResult] = await Promise.all([loadLeanMetrics(30), loadKaizen(), loadAudits()]);
  const fiveS = summarizeAudits(auditsResult.audits);
  const ideas = kaizen.ideas;
  const counts = Object.fromEntries(KAIZEN_STAGES.map((stage) => [stage.key, ideas.filter((idea) => idea.status === stage.key).length]));
  const standardized = ideas.filter((idea) => idea.status === "padronizada");
  const gain = standardized.reduce((sum, idea) => sum + (idea.gain_minutes_day ?? 0), 0);
  const fiveSOverall = fiveS.overall;
  const level = fiveSOverall == null ? null : fiveSLevel(fiveSOverall);

  // "Onde atacar agora": recomendações automáticas a partir dos dados.
  const actions: { icon: typeof Target; title: string; text: string; href: string; tone: "bad" | "warn" | "ok" }[] = [];
  const vital = metrics.pareto.filter((item) => item.vital);
  if (vital.length) {
    actions.push({
      icon: Target,
      title: `Atacar "${vital[0].name}"`,
      text: `${vital.length === 1 ? "Esta causa responde" : `As ${vital.length} principais causas respondem`} por ${pct(vital[vital.length - 1].cumulative)} das ocorrências (Pareto 80/20). Abra um Kaizen com 5 Porquês.`,
      href: "/melhoria/kaizen?nova=1",
      tone: "bad",
    });
  }
  if (metrics.cycle.bottleneck) {
    const row = metrics.cycle.rows.find((item) => item.key === metrics.cycle.bottleneck)!;
    actions.push({
      icon: Gauge,
      title: `Gargalo: ${STEP_LABEL[row.key as StepKey]}`,
      text: `Etapa mais lenta (${num(row.minutes)} min em média). Pela Teoria das Restrições, cada minuto ganho aqui aumenta a vazão do laboratório inteiro.`,
      href: "/melhoria/indicadores",
      tone: "warn",
    });
  }
  const overWip = Object.entries(metrics.settings.wip ?? {}).filter(([status, limit]) => wipState(metrics.wipByStatus[status] ?? 0, limit) === "estourado");
  for (const [status, limit] of overWip.slice(0, 1)) {
    actions.push({
      icon: TriangleAlert,
      title: `WIP acima do limite em ${STATUS_LABEL[status as OrderStatus]}`,
      text: `${metrics.wipByStatus[status]} OS para um limite de ${limit}. Pare de puxar novas OS para essa coluna e ajude a liberar o fluxo.`,
      href: "/laboratorio?view=kanban",
      tone: "bad",
    });
  }
  const weakest = [...fiveS.areas].sort((a, b) => a.percent - b.percent)[0];
  if (weakest && weakest.percent < 0.8) {
    actions.push({
      icon: ClipboardCheck,
      title: `5S: reforçar ${weakest.area}`,
      text: `Área com menor nota (${pct(weakest.percent)}). Faça uma auditoria com a equipe e transforme as pendências em ações.`,
      href: "/melhoria/5s",
      tone: "warn",
    });
  }
  if (metrics.otd != null && metrics.otd < 0.9) {
    actions.push({
      icon: Activity,
      title: "Entrega no prazo abaixo de 90%",
      text: `${pct(metrics.otd)} das OS saíram no prazo. Use a bancada pela ordem de prazo (FIFO por vencimento) e acompanhe o risco de atraso.`,
      href: "/montagem",
      tone: "warn",
    });
  }
  if (actions.length === 0) {
    actions.push({ icon: Lightbulb, title: "Processo estável", text: "Nenhum alerta no momento. Bom momento para registrar ideias de Kaizen com a equipe.", href: "/melhoria/kaizen?nova=1", tone: "ok" });
  }

  return (
    <div className="grid gap-5 animate-[pagein_.35s_ease-out]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Nível sigma do processo"
          value={metrics.sigma == null ? "—" : `${num(metrics.sigma, 2)}σ`}
          badge={metrics.dpmo == null ? undefined : `${metrics.dpmo.toLocaleString("pt-BR")} DPMO`}
          tone={sigmaTone(metrics.sigma)}
          hint="últimos 30 dias"
          tool="6σ"
        />
        <Kpi
          label="Aprovação de primeira (FPY)"
          value={pct(metrics.fpy)}
          tone={metrics.fpy == null ? "neutral" : metrics.fpy >= 0.95 ? "ok" : metrics.fpy >= 0.85 ? "warn" : "bad"}
          hint={`${metrics.completed} OS prontas`}
          tool="Qualidade"
        />
        <Kpi
          label="Entrega no prazo (OTD)"
          value={pct(metrics.otd)}
          tone={metrics.otd == null ? "neutral" : metrics.otd >= 0.95 ? "ok" : metrics.otd >= 0.85 ? "warn" : "bad"}
          hint={`lead time ${hours(metrics.leadTimeMedianH)} (mediana)`}
          tool="Lean"
        />
        <Kpi
          label="Índice 5S"
          value={pct(fiveSOverall)}
          badge={level?.label}
          tone={level?.tone ?? "neutral"}
          hint={`${fiveS.areas.length} ${fiveS.areas.length === 1 ? "área auditada" : "áreas auditadas"}`}
          tool="5S"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Card title="Onde atacar agora" subtitle="Recomendações geradas a partir das OS, ocorrências, Kanban e auditorias 5S">
          <ul className="grid gap-2.5">
            {actions.slice(0, 4).map((action) => {
              const Icon = action.icon;
              const color = { bad: "#a3261b", warn: "#8a5a00", ok: "#1c6b43" }[action.tone];
              const bg = { bad: "#fdecea", warn: "#fdf3dc", ok: "#e6f4ec" }[action.tone];
              return (
                <li key={action.title}>
                  <Link href={action.href} className="group flex items-start gap-3 rounded-lg border border-[#eef1f3] p-3 transition-colors hover:border-[#cdd5d8] hover:bg-[#fafbfb]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: bg, color }}>
                      <Icon size={18} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-semibold">{action.title}</span>
                      <span className="text-[13px] leading-snug text-[#6e7c7a]">{action.text}</span>
                    </span>
                    <ArrowRight size={16} className="mt-1 shrink-0 text-[#8a9694] transition-transform group-hover:translate-x-0.5 group-hover:text-[#0e6b62]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title="Kaizen em andamento"
          subtitle="Pequenas melhorias contínuas no ciclo PDCA"
          action={
            <Link href="/melhoria/kaizen" className="text-[13px] font-semibold text-[#0e6b62] hover:underline">
              Abrir quadro
            </Link>
          }
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <PdcaWheel counts={counts} />
            <div className="grid w-full gap-3">
              <div className="rounded-lg bg-[#f2f7f6] p-3">
                <p className="text-xs font-medium text-[#6e7c7a]">Melhorias padronizadas</p>
                <p className="tabular text-2xl font-semibold">{standardized.length}</p>
              </div>
              <div className="rounded-lg bg-[#f2f7f6] p-3">
                <p className="text-xs font-medium text-[#6e7c7a]">Tempo devolvido à equipe</p>
                <p className="tabular text-2xl font-semibold">
                  {gain} <span className="text-sm font-medium text-[#6e7c7a]">min/dia</span>
                </p>
              </div>
              <Link href="/melhoria/kaizen?nova=1" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0e6b62] px-3.5 text-sm font-semibold text-white hover:bg-[#0b5850]">
                <Lightbulb size={16} /> Registrar ideia
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/melhoria/indicadores", tool: "Lean Six Sigma", text: "Pareto, carta de controle, nível sigma, gargalo e takt time.", value: `${metrics.defects} ocorrências`, icon: Activity },
          { href: "/melhoria/kaizen", tool: "Kaizen", text: "Ideias da equipe com 5 Porquês, matriz impacto × esforço e PDCA.", value: `${ideas.length} ideias`, icon: Lightbulb },
          { href: "/melhoria/5s", tool: "Auditoria 5S", text: "Checklist por senso, nota de 0 a 5, radar e evolução por área.", value: `${auditsResult.audits.length} auditorias`, icon: ClipboardCheck },
          { href: "/laboratorio?view=kanban", tool: "Kanban puxado", text: "Limites WIP por coluna: o quadro avisa quando o fluxo trava.", value: `${metrics.wip} OS em processo`, icon: Gauge },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="group flex flex-col gap-2 rounded-xl border border-[#e2e7e9] bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#bcd9d4] hover:shadow-[0_10px_28px_-18px_rgba(14,107,98,0.6)]">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon size={16} className="text-[#0e6b62]" />
                {item.tool}
              </span>
              <span className="text-[13px] leading-snug text-[#6e7c7a]">{item.text}</span>
              <span className="mt-auto flex items-center justify-between pt-1">
                <Pill>{item.value}</Pill>
                <ArrowRight size={15} className="text-[#8a9694] transition-transform group-hover:translate-x-0.5 group-hover:text-[#0e6b62]" />
              </span>
            </Link>
          );
        })}
      </div>

      {can(role, "settings.write") ? (
        <Card title="Kanban puxado: limites WIP" subtitle="Limite de OS por coluna. Deixe em branco para não limitar. O quadro do laboratório fica vermelho quando passa do limite.">
          <LeanSettingsForm settings={metrics.settings} wipNow={metrics.wipByStatus} />
        </Card>
      ) : null}
    </div>
  );
}
