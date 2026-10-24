import { STEP_KEYS, STEP_LABEL, type StepKey } from "./constants";

/* ----------------------------------------------------------------------------
 * Lean Six Sigma — indicadores calculados a partir das OS, etapas e ocorrências.
 * Funções puras para poderem ser testadas sem banco.
 * ------------------------------------------------------------------------- */

export const OPPORTUNITIES_PER_UNIT = STEP_KEYS.length; // 5 etapas = 5 oportunidades de defeito por OS

/** Inversa da normal padrão (algoritmo de Acklam, erro < 1e-9). */
export function inverseNormal(p: number) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** DPMO e nível sigma (com o deslocamento de 1,5σ usado na indústria). */
export function sigmaLevel(defects: number, units: number, opportunities = OPPORTUNITIES_PER_UNIT) {
  if (units <= 0 || opportunities <= 0) return { dpmo: null, sigma: null, yieldPct: null };
  const total = units * opportunities;
  const dpmo = (Math.min(defects, total) / total) * 1_000_000;
  const yieldRatio = 1 - dpmo / 1_000_000;
  const sigma = defects === 0 ? 6 : Math.min(6, Math.max(0, inverseNormal(yieldRatio) + 1.5));
  return { dpmo: Math.round(dpmo), sigma: Math.round(sigma * 100) / 100, yieldPct: yieldRatio };
}

/** First Pass Yield: OS concluídas sem nenhuma ocorrência de qualidade. */
export function firstPassYield(completedOrderIds: string[], defectiveOrderIds: string[]) {
  const done = new Set(completedOrderIds);
  if (done.size === 0) return null;
  const defective = new Set(defectiveOrderIds.filter((id) => done.has(id)));
  return (done.size - defective.size) / done.size;
}

export type FlowOrder = {
  id: string;
  entered_at: string;
  due_at: string | null;
  completed_at: string | null;
  delivered_at?: string | null;
};

const HOUR = 36e5;

/** Lead time médio/mediano (entrada → pronto), em horas, e entrega no prazo (OTD). */
export function flowMetrics(orders: FlowOrder[]) {
  const done = orders.filter((order) => order.completed_at);
  const leadTimes = done
    .map((order) => (new Date(order.completed_at!).getTime() - new Date(order.entered_at).getTime()) / HOUR)
    .filter((hours) => Number.isFinite(hours) && hours >= 0)
    .sort((a, b) => a - b);
  const withDue = done.filter((order) => order.due_at);
  const onTime = withDue.filter((order) => new Date(order.completed_at!).getTime() <= new Date(order.due_at!).getTime());
  const mean = leadTimes.length ? leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length : null;
  const median = leadTimes.length
    ? leadTimes.length % 2
      ? leadTimes[(leadTimes.length - 1) / 2]
      : (leadTimes[leadTimes.length / 2 - 1] + leadTimes[leadTimes.length / 2]) / 2
    : null;
  return {
    completed: done.length,
    leadTimeMeanH: mean,
    leadTimeMedianH: median,
    leadTimeP90H: leadTimes.length ? leadTimes[Math.min(leadTimes.length - 1, Math.floor(leadTimes.length * 0.9))] : null,
    otd: withDue.length ? onTime.length / withDue.length : null,
  };
}

/** Lei de Little: lead time esperado = WIP ÷ throughput. */
export function littleLeadTimeDays(wip: number, throughputPerDay: number) {
  if (throughputPerDay <= 0) return null;
  return wip / throughputPerDay;
}

/** Takt time em minutos: tempo disponível ÷ demanda. */
export function taktMinutes(availableMinutesPerDay: number, demandPerDay: number) {
  if (demandPerDay <= 0 || availableMinutesPerDay <= 0) return null;
  return availableMinutesPerDay / demandPerDay;
}

export type ParetoItem = { name: string; count: number; percent: number; cumulative: number; vital: boolean };

/** Pareto 80/20: ordena por frequência e marca os "poucos vitais" até 80% acumulado. */
export function pareto(values: string[]): ParetoItem[] {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  const total = values.length;
  let running = 0;
  let reached = false;
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([name, count]) => {
      const percent = total ? count / total : 0;
      const vital = !reached;
      running += count;
      const cumulative = total ? running / total : 0;
      if (cumulative >= 0.8) reached = true;
      return { name, count, percent, cumulative, vital };
    });
}

export type ControlPoint = { label: string; value: number; ucl: number; cl: number; lcl: number; out: boolean };

/**
 * Carta de controle u (defeitos por unidade) diária.
 * u = defeitos/unidades do dia; ū = Σdefeitos/Σunidades; UCL/LCL = ū ± 3·√(ū/nᵢ).
 */
export function uChart(days: { label: string; defects: number; units: number }[]): { points: ControlPoint[]; center: number | null } {
  const totalUnits = days.reduce((sum, day) => sum + day.units, 0);
  const totalDefects = days.reduce((sum, day) => sum + day.defects, 0);
  if (totalUnits === 0) return { points: [], center: null };
  const center = totalDefects / totalUnits;
  const points = days
    .filter((day) => day.units > 0)
    .map((day) => {
      const value = day.defects / day.units;
      const sigma = Math.sqrt(center / day.units);
      const ucl = center + 3 * sigma;
      const lcl = Math.max(0, center - 3 * sigma);
      return { label: day.label, value, ucl, cl: center, lcl, out: value > ucl || value < lcl };
    });
  return { points, center };
}

export type StepTiming = { step_key: string; started_at: string | null; completed_at: string | null };

/** Tempo médio por etapa (min) e gargalo (Teoria das Restrições: a etapa mais lenta dita o ritmo). */
export function stepCycleTimes(steps: StepTiming[]) {
  const sums = new Map<string, { total: number; n: number }>();
  for (const step of steps) {
    if (!step.started_at || !step.completed_at) continue;
    const minutes = (new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 60000;
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 8 * 60) continue; // descarta outliers (> 8h parado)
    const entry = sums.get(step.step_key) ?? { total: 0, n: 0 };
    entry.total += minutes;
    entry.n += 1;
    sums.set(step.step_key, entry);
  }
  const rows = STEP_KEYS.map((key) => {
    const entry = sums.get(key);
    return { key, label: STEP_LABEL[key as StepKey], minutes: entry && entry.n ? entry.total / entry.n : null, samples: entry?.n ?? 0 };
  });
  const measured = rows.filter((row) => row.minutes !== null);
  const bottleneck = measured.length ? measured.reduce((max, row) => (row.minutes! > max.minutes! ? row : max)) : null;
  return { rows, bottleneck: bottleneck?.key ?? null };
}

/* ----------------------------------------------------------------------------
 * 5S
 * ------------------------------------------------------------------------- */

export const FIVE_S = [
  {
    key: "seiri",
    jp: "Seiri",
    pt: "Utilização",
    hint: "Separar o necessário do desnecessário",
    questions: [
      "Só há na bancada o que é usado na montagem do dia",
      "Lentes, armações e peças sem uso foram retiradas da área",
      "Ferramentas quebradas ou sem uso foram descartadas ou etiquetadas",
      "Não há OS antigas ou papéis acumulados no posto",
    ],
  },
  {
    key: "seiton",
    jp: "Seiton",
    pt: "Organização",
    hint: "Um lugar para cada coisa e cada coisa em seu lugar",
    questions: [
      "Cada ferramenta tem lugar demarcado (quadro de sombras)",
      "Bandejas de OS identificadas e ordenadas por prazo",
      "Estoque de lentes endereçado e etiquetado",
      "Qualquer pessoa encontra um item em menos de 30 segundos",
    ],
  },
  {
    key: "seiso",
    jp: "Seiso",
    pt: "Limpeza",
    hint: "Limpar inspecionando",
    questions: [
      "Bancada, piso e máquinas limpos no início e no fim do turno",
      "Facetadora sem resíduo acumulado e reservatório em dia",
      "Lensômetro e blocador limpos e calibrados",
      "Fontes de sujeira identificadas e tratadas",
    ],
  },
  {
    key: "seiketsu",
    jp: "Seiketsu",
    pt: "Padronização",
    hint: "Manter os três primeiros sensos com padrões visuais",
    questions: [
      "Existe checklist 5S visível no posto",
      "Procedimentos das etapas estão à vista (trabalho padronizado)",
      "Gestão à vista: quadro de prazos e indicadores atualizado",
      "Os padrões são iguais entre os turnos e operadores",
    ],
  },
  {
    key: "shitsuke",
    jp: "Shitsuke",
    pt: "Disciplina",
    hint: "Cumprir os padrões sem precisar cobrar",
    questions: [
      "A equipe segue o checklist sem precisar de cobrança",
      "A última auditoria teve suas pendências tratadas",
      "Novos colaboradores foram treinados no 5S",
      "A equipe sugere melhorias (Kaizen) com frequência",
    ],
  },
] as const;

export type FiveSKey = (typeof FIVE_S)[number]["key"];
export const FIVE_S_KEYS = FIVE_S.map((sense) => sense.key) as FiveSKey[];

/** Resposta por pergunta: 0 = não atende, 1 = parcial, 2 = atende. Nota do senso de 0 a 5. */
export function senseScore(answers: number[]) {
  if (answers.length === 0) return 0;
  const max = answers.length * 2;
  const total = answers.reduce((sum, value) => sum + Math.max(0, Math.min(2, value)), 0);
  return Math.round((total / max) * 5 * 2) / 2; // meio ponto
}

export type FiveSScores = Record<FiveSKey, number>;

export function fiveSTotal(scores: FiveSScores) {
  const values = FIVE_S_KEYS.map((key) => Number(scores[key]) || 0);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { average, percent: average / 5 };
}

export function fiveSLevel(percent: number) {
  if (percent >= 0.9) return { label: "Excelência", tone: "ok" as const };
  if (percent >= 0.75) return { label: "Bom", tone: "ok" as const };
  if (percent >= 0.5) return { label: "Em evolução", tone: "warn" as const };
  return { label: "Crítico", tone: "bad" as const };
}

/* ----------------------------------------------------------------------------
 * Kaizen
 * ------------------------------------------------------------------------- */

export const KAIZEN_STAGES = [
  { key: "ideia", pdca: "P", label: "Planejar", hint: "Ideia registrada, causa e proposta" },
  { key: "em_teste", pdca: "D", label: "Executar", hint: "Teste em pequena escala" },
  { key: "verificacao", pdca: "C", label: "Verificar", hint: "Medir o resultado" },
  { key: "padronizada", pdca: "A", label: "Padronizar", hint: "Virou padrão de trabalho" },
] as const;

export type KaizenStatus = (typeof KAIZEN_STAGES)[number]["key"] | "descartada";

export const KAIZEN_CATEGORIES = {
  qualidade: "Qualidade",
  fluxo: "Fluxo",
  "5s": "5S",
  seguranca: "Segurança",
  custo: "Custo",
  ergonomia: "Ergonomia",
} as const;

export type KaizenCategory = keyof typeof KAIZEN_CATEGORIES;

/** Matriz impacto × esforço: prioriza ganhos rápidos. */
export function kaizenPriority(impact: number, effort: number) {
  if (impact >= 3 && effort <= 1) return { label: "Ganho rápido", rank: 1 };
  if (impact >= 2 && effort <= 2) return { label: "Fazer agora", rank: 2 };
  if (impact >= 3) return { label: "Projeto", rank: 3 };
  if (effort <= 1) return { label: "Simples", rank: 4 };
  return { label: "Reavaliar", rank: 5 };
}

export function nextKaizenStatus(status: KaizenStatus): KaizenStatus | null {
  const index = KAIZEN_STAGES.findIndex((stage) => stage.key === status);
  if (index < 0 || index === KAIZEN_STAGES.length - 1) return null;
  return KAIZEN_STAGES[index + 1].key;
}

/* ----------------------------------------------------------------------------
 * Kanban — limites WIP
 * ------------------------------------------------------------------------- */

export type LeanSettings = {
  wip?: Partial<Record<string, number>>;
  available_minutes_per_day?: number;
};

export function wipState(count: number, limit?: number | null) {
  if (!limit || limit <= 0) return "livre" as const;
  if (count > limit) return "estourado" as const;
  if (count === limit) return "no_limite" as const;
  return "ok" as const;
}
