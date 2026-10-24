/**
 * Ranking do laboratório. Tudo é calculado a partir do que já é registrado
 * na operação (etapas concluídas, OS abertas e ocorrências), sem digitação extra.
 *
 * Montadores — pontos:
 *   + 10 por montagem (etapa Facetadora concluída pela pessoa)
 *   +  3 extra se essa montagem saiu dentro do prazo da OS
 *   +  2 por qualquer outra etapa concluída
 *   − 15 por ocorrência de qualidade atribuída à etapa feita pela pessoa
 * Vendedores e lojas — OS enviadas ao laboratório no período.
 */
export const RANK_POINTS = { montagem: 10, noPrazo: 3, etapa: 2, ocorrencia: -15 } as const;

export type RankBoardKey = "montadores" | "vendedores" | "lojas";
export type RankPeriod = "hoje" | "semana" | "mes";

export type RankEntry = {
  id: string;
  name: string;
  score: number;
  /** Quantidade que conta para a meta (montagens ou OS). */
  done: number;
  goal: number | null;
  stats: { label: string; value: string }[];
};

export type RankBoard = {
  key: RankBoardKey;
  label: string;
  scoreLabel: string;
  doneLabel: string;
  entries: RankEntry[];
};

export type RankingSettings = {
  premios?: string[];
  metas?: Partial<Record<RankBoardKey, Partial<Record<RankPeriod, number>>>>;
  rotacao?: number;
};

type StepInput = { order_id: string; step_key: string; assignee_id: string | null; completed_at: string | null };
type OccurrenceInput = { order_id: string; step_key: string | null };
type OrderInput = {
  id: string;
  due_at: string | null;
  seller_id: string | null;
  store_id: string | null;
  status: string;
  completed_at: string | null;
};

function byScore(a: RankEntry, b: RankEntry) {
  return b.score - a.score || b.done - a.done || a.name.localeCompare(b.name, "pt-BR");
}

function pct(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "—";
}

export function rankAssemblers(input: {
  people: { id: string; name: string }[];
  steps: StepInput[];
  occurrences: OccurrenceInput[];
  dueByOrder: Map<string, string | null>;
  goal: number | null;
}): RankEntry[] {
  type Acc = { montagens: number; noPrazo: number; etapas: number; ocorrencias: number };
  const acc = new Map<string, Acc>();
  const get = (id: string) => {
    let row = acc.get(id);
    if (!row) acc.set(id, (row = { montagens: 0, noPrazo: 0, etapas: 0, ocorrencias: 0 }));
    return row;
  };

  // Quem fez cada etapa de cada OS, para atribuir as ocorrências.
  const owner = new Map<string, string>();
  for (const step of input.steps) {
    if (!step.assignee_id) continue;
    owner.set(`${step.order_id}:${step.step_key}`, step.assignee_id);
    const row = get(step.assignee_id);
    if (step.step_key === "facetadora") {
      row.montagens += 1;
      const due = input.dueByOrder.get(step.order_id);
      if (due && step.completed_at && new Date(step.completed_at) <= new Date(due)) row.noPrazo += 1;
    } else {
      row.etapas += 1;
    }
  }
  for (const occurrence of input.occurrences) {
    const who =
      (occurrence.step_key && owner.get(`${occurrence.order_id}:${occurrence.step_key}`)) ||
      owner.get(`${occurrence.order_id}:facetadora`);
    if (who) get(who).ocorrencias += 1;
  }

  const names = new Map(input.people.map((person) => [person.id, person.name]));
  const ids = new Set([...input.people.map((person) => person.id), ...acc.keys()]);
  return [...ids]
    .map((id) => {
      const row = acc.get(id) ?? { montagens: 0, noPrazo: 0, etapas: 0, ocorrencias: 0 };
      const score =
        row.montagens * RANK_POINTS.montagem +
        row.noPrazo * RANK_POINTS.noPrazo +
        row.etapas * RANK_POINTS.etapa +
        row.ocorrencias * RANK_POINTS.ocorrencia;
      return {
        id,
        name: names.get(id) ?? "Sem nome",
        score: Math.max(0, score),
        done: row.montagens,
        goal: input.goal,
        stats: [
          { label: "Montagens", value: String(row.montagens) },
          { label: "No prazo", value: pct(row.noPrazo, row.montagens) },
          { label: "Etapas", value: String(row.etapas) },
          { label: "Ocorrências", value: String(row.ocorrencias) },
        ],
      };
    })
    .sort(byScore);
}

export function rankByOrders(input: {
  subjects: { id: string; name: string }[];
  orders: OrderInput[];
  field: "seller_id" | "store_id";
  goal: number | null;
  now: Date;
}): RankEntry[] {
  const acc = new Map<string, { total: number; entregues: number; atrasadas: number }>();
  for (const order of input.orders) {
    const id = order[input.field];
    if (!id || order.status === "cancelado") continue;
    const row = acc.get(id) ?? { total: 0, entregues: 0, atrasadas: 0 };
    row.total += 1;
    if (order.status === "pronto" || order.status === "entregue") row.entregues += 1;
    const late =
      order.due_at &&
      ((order.completed_at && new Date(order.completed_at) > new Date(order.due_at)) ||
        (!order.completed_at && new Date(order.due_at) < input.now));
    if (late) row.atrasadas += 1;
    acc.set(id, row);
  }
  const names = new Map(input.subjects.map((item) => [item.id, item.name]));
  const ids = new Set([...input.subjects.map((item) => item.id), ...acc.keys()]);
  return [...ids]
    .map((id) => {
      const row = acc.get(id) ?? { total: 0, entregues: 0, atrasadas: 0 };
      return {
        id,
        name: names.get(id) ?? "Sem nome",
        score: row.total,
        done: row.total,
        goal: input.goal,
        stats: [
          { label: "OS enviadas", value: String(row.total) },
          { label: "Prontas/entregues", value: String(row.entregues) },
          { label: "Com atraso", value: String(row.atrasadas) },
        ],
      };
    })
    .sort(byScore);
}

export function goalProgress(entry: Pick<RankEntry, "done" | "goal">) {
  if (!entry.goal || entry.goal <= 0) return null;
  return {
    percent: Math.min(100, Math.round((entry.done / entry.goal) * 1000) / 10),
    missing: Math.max(0, entry.goal - entry.done),
  };
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
