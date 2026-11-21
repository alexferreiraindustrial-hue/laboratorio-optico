import { canCompleteStep, canStartStep } from "./assembly";
import { STEP_KEYS, STEP_LABEL, type AppRole, type OrderStatus, type StepKey, type StepStatus } from "./constants";
import { forecastOrder, type Risk } from "./forecast";
import { can } from "./permissions";
import { canTransition } from "./status";
import { visibleOrderNumber } from "./orders";

export type BenchOrder = {
  id: string;
  number: string;
  clientName: string;
  laboratoryName: string | null;
  sellerName: string | null;
  storeName: string | null;
  externalOrderId: string | null;
  dueAt: string | null;
  enteredAt: string;
  status: Extract<OrderStatus, "aguardando_montagem" | "em_montagem" | "em_correcao" | "em_conferencia">;
  urgent: boolean;
  openOccurrences: number | null;
  steps: { key: StepKey; status: StepStatus; startedAt: string | null; assignee: string | null; assigneeId: string | null }[];
};

type NextAction =
  | { kind: "status"; to: OrderStatus; label: string; note: string }
  | { kind: "step"; action: "iniciar" | "concluir"; step: StepKey; label: string }
  | { kind: "none"; label: string };

export function nextBenchAction(order: BenchOrder, role: AppRole): NextAction {
  if (order.status === "aguardando_montagem") {
    return canTransition(order.status, "em_montagem", role)
      ? { kind: "status", to: "em_montagem", label: "Começar montagem", note: "Início pela bancada" }
      : { kind: "none", label: "Aguardando montador" };
  }
  if (order.status === "em_correcao") {
    return canTransition(order.status, "em_montagem", role)
      ? { kind: "status", to: "em_montagem", label: "Retomar montagem", note: "Retomada após correção pela bancada" }
      : { kind: "none", label: "Correção em acompanhamento" };
  }
  if (!can(role, "assembly.write")) return { kind: "none", label: "Somente consulta" };
  const snapshots = order.steps.map((step) => ({ key: step.key, status: step.status }));
  for (const key of STEP_KEYS) {
    const step = order.steps.find((item) => item.key === key);
    if (!step) return { kind: "none", label: "Etapas incompletas: abrir detalhes" };
    if (step.status === "concluida") continue;
    if (step.status === "em_andamento" && canCompleteStep(snapshots, key)) {
      return { kind: "step", action: "concluir", step: key, label: `Concluir ${STEP_LABEL[key].toLowerCase()}` };
    }
    if (canStartStep(snapshots, key)) {
      return { kind: "step", action: "iniciar", step: key, label: `Iniciar ${STEP_LABEL[key].toLowerCase()}` };
    }
    return { kind: "none", label: `${STEP_LABEL[key]} bloqueada` };
  }
  if (order.status === "em_conferencia" && order.openOccurrences !== 0) {
    return { kind: "none", label: order.openOccurrences === null ? "Conferir ocorrências nos detalhes" : "Resolver ocorrências antes de liberar" };
  }
  if (order.status === "em_conferencia" && canTransition(order.status, "pronto", role)) {
    return { kind: "status", to: "pronto", label: "Marcar como pronta", note: "Conferida na bancada" };
  }
  if (order.status === "em_montagem" && canTransition(order.status, "em_conferencia", role)) {
    return { kind: "status", to: "em_conferencia", label: "Enviar para conferência", note: "Etapas concluídas" };
  }
  return { kind: "none", label: "Sem ação pendente" };
}


export const BENCH_LANES: { status: BenchOrder["status"]; title: string; hint: string; color: string }[] = [
  { status: "aguardando_montagem", title: "Aguardando montagem", hint: "Lentes liberadas · puxar próxima OS", color: "#6e6a63" },
  { status: "em_montagem", title: "Em montagem", hint: "Executar e registrar as cinco etapas", color: "#8c6239" },
  { status: "em_correcao", title: "Em correção", hint: "Resolver impedimentos e retomar", color: "#b83a3a" },
  { status: "em_conferencia", title: "Conferência de qualidade", hint: "Inspeção final antes da liberação", color: "#8a5a00" },
];

export function benchForecast(order: BenchOrder, now: Date) {
  return forecastOrder({ status: order.status, dueAt: order.dueAt, stepsDone: order.steps.filter((step) => step.status === "concluida").length, now });
}

export type BenchFocus = "all" | "risk" | "mine" | "unassigned" | "critical";
export type BenchSort = "risk" | "deadline" | "oldest";
const RANK: Record<Risk, number> = { atrasada: 0, risco: 1, atencao: 2, sem_prazo: 3, no_prazo: 4, pronta: 5, entregue: 6, cancelada: 7 };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function selectBenchOrders(orders: BenchOrder[], options: { query: string; focus: BenchFocus; assigneeId: string; sort: BenchSort; userId: string }, now: Date) {
  const query = normalize(options.query.trim());
  const rows = orders.map((order) => ({ order, risk: benchForecast(order, now).risk, running: order.steps.find((step) => step.status === "em_andamento") })).filter(({ order, risk, running }) => {
    if (query && !normalize([visibleOrderNumber(order), order.number, order.clientName, order.sellerName, order.storeName, order.laboratoryName, running?.assignee].filter(Boolean).join(" ")).includes(query)) return false;
    if (options.assigneeId && running?.assigneeId !== options.assigneeId) return false;
    if (options.focus === "mine" && (!options.userId || running?.assigneeId !== options.userId)) return false;
    if (options.focus === "unassigned" && running?.assigneeId) return false;
    if (options.focus === "risk" && !["atrasada", "risco", "atencao"].includes(risk)) return false;
    if (options.focus === "critical" && !order.urgent) return false;
    return true;
  });
  return rows.sort((a, b) => {
    if (options.sort === "risk") {
      const risk = RANK[a.risk] - RANK[b.risk];
      if (risk) return risk;
      if (a.order.urgent !== b.order.urgent) return a.order.urgent ? -1 : 1;
    }
    if (options.sort !== "oldest") {
      const due = (a.order.dueAt ? Date.parse(a.order.dueAt) : Infinity) - (b.order.dueAt ? Date.parse(b.order.dueAt) : Infinity);
      if (due && !Number.isNaN(due)) return due;
    }
    return a.order.enteredAt.localeCompare(b.order.enteredAt) || a.order.id.localeCompare(b.order.id);
  }).map(({ order }) => order);
}

/** Deadline signals remain explicit even when the card is collapsed. */
export function benchDeadlineSignal(order: BenchOrder, now: Date): { level: "late" | "critical" | "soon" | "attention" | "normal" | "none"; label: string } {
 const hours = order.dueAt ? (Date.parse(order.dueAt)-now.getTime())/3600000 : NaN;
 if (Number.isFinite(hours) && hours < 0) return {level:"late",label:"Em atraso"};
 if (order.urgent) return {level:"critical",label:"Prioridade crítica"};
 if (!Number.isFinite(hours)) return {level:"none",label:"Sem prazo informado"};
 if (hours <= 4) return {level:"critical",label:"Prazo imediato · até 4h"};
 if (benchForecast(order,now).risk === "risco") return {level:"critical",label:"Risco de não concluir no prazo"};
 if (hours <= 24) return {level:"soon",label:"Vence em até 24h"};
 if (hours <= 48) return {level:"attention",label:"Prazo próximo · até 48h"};
 return {level:"normal",label:"No prazo"};
}
