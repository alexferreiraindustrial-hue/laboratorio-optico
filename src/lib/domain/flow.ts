import { visibleOrderNumber } from "./orders";

/**
 * Fluxo da lente: o vendedor promete uma data ao cliente e o laboratório externo
 * informa quando a lente chega. A lente precisa chegar ANTES do prazo, com folga
 * para a montagem. Aqui calculamos essa folga e o risco.
 */

/** Tempo mínimo entre a lente chegar e o óculos ficar pronto (fila + 5 etapas + conferência). */
export const ASSEMBLY_BUFFER_HOURS = 24;

export type LensRisk = "sem_previsao" | "sem_prazo" | "lente_atrasada" | "vai_atrasar" | "apertado" | "ok" | "chegou";

export const LENS_RISK: Record<LensRisk, { label: string; fg: string; bg: string; rank: number }> = {
  lente_atrasada: { label: "Lente atrasada", fg: "#ffffff", bg: "#b42318", rank: 0 },
  vai_atrasar: { label: "Vai estourar o prazo", fg: "#a3261b", bg: "#fdecea", rank: 1 },
  apertado: { label: "Prazo apertado", fg: "#8a5a00", bg: "#fdf3dc", rank: 2 },
  sem_previsao: { label: "Sem previsão do laboratório", fg: "#44524f", bg: "#eef1f3", rank: 3 },
  ok: { label: "No prazo", fg: "#1c6b43", bg: "#e3f4ea", rank: 4 },
  sem_prazo: { label: "Sem prazo com o cliente", fg: "#6e7c7a", bg: "#f2f4f5", rank: 5 },
  chegou: { label: "Lente chegou", fg: "#1c6b43", bg: "#e3f4ea", rank: 6 },
};

export function lensRisk(input: {
  dueAt: string | null;
  lensExpectedAt: string | null;
  arrivedAt?: string | null;
  now?: Date;
  bufferHours?: number;
}): { risk: LensRisk; slackHours: number | null; latestArrival: Date | null } {
  const now = input.now ?? new Date();
  const buffer = input.bufferHours ?? ASSEMBLY_BUFFER_HOURS;
  const due = input.dueAt ? new Date(input.dueAt) : null;
  const latestArrival = due ? new Date(due.getTime() - buffer * 36e5) : null;
  if (input.arrivedAt) return { risk: "chegou", slackHours: null, latestArrival };
  const eta = input.lensExpectedAt ? new Date(input.lensExpectedAt) : null;

  if (eta && eta.getTime() < now.getTime() - 36e5) {
    return { risk: "lente_atrasada", slackHours: latestArrival ? (latestArrival.getTime() - now.getTime()) / 36e5 : null, latestArrival };
  }
  if (!eta) {
    if (latestArrival && latestArrival.getTime() < now.getTime()) {
      return { risk: "vai_atrasar", slackHours: (latestArrival.getTime() - now.getTime()) / 36e5, latestArrival };
    }
    return { risk: due ? "sem_previsao" : "sem_prazo", slackHours: null, latestArrival };
  }
  if (!latestArrival) return { risk: "sem_prazo", slackHours: null, latestArrival };
  const slack = (latestArrival.getTime() - eta.getTime()) / 36e5;
  if (slack < 0) return { risk: "vai_atrasar", slackHours: slack, latestArrival };
  if (slack < 12) return { risk: "apertado", slackHours: slack, latestArrival };
  return { risk: "ok", slackHours: slack, latestArrival };
}

/* ----------------------------------------------------------------------------
 * Lançamento: atalhos digitados no campo para trocar vendedor ou loja.
 *   "v2" ou "v 2"  -> vendedor de código 2
 *   "l3"           -> loja de código 3
 *   "v0" / "l0"    -> sem vendedor / sem loja
 * ------------------------------------------------------------------------- */
export type TargetCommand = { kind: "seller" | "store"; code: number };

export function parseTargetCommand(line: string): TargetCommand | null {
  const match = line.trim().match(/^([vl])\s*[-:.]?\s*(\d{1,3})$/i);
  if (!match) return null;
  return { kind: match[1].toLowerCase() === "v" ? "seller" : "store", code: Number(match[2]) };
}

/* ----------------------------------------------------------------------------
 * BO / Assistência
 * ------------------------------------------------------------------------- */
export const BO_DECISIONS = {
  nova_lente: { label: "Pedir nova lente", hint: "Volta para aguardando lentes com nova previsão" },
  refazer: { label: "Refazer a montagem", hint: "Volta para a bancada" },
  reparo: { label: "Reparo no laboratório", hint: "Ajuste sem trocar a lente" },
  cliente_aceita: { label: "Cliente aceitou", hint: "Segue como está e encerra o BO" },
  cancelar: { label: "Cancelar a OS", hint: "Somente gestor" },
} as const;

export type BoDecision = keyof typeof BO_DECISIONS;

export type BoStage = "avisar" | "aguardando_decisao" | "em_tratamento";

export function boStage(input: { notified_at: string | null; decision: string | null }): BoStage {
  if (input.decision) return "em_tratamento";
  if (input.notified_at) return "aguardando_decisao";
  return "avisar";
}

export function boMessage(input: {
  sellerName?: string | null;
  number: string;
  externalOrderId?: string | null;
  clientName: string;
  step?: string | null;
  category: string;
  description: string;
}) {
  const first = input.sellerName?.trim().split(/\s+/)[0];
  const shown = visibleOrderNumber({ number: input.number, externalOrderId: input.externalOrderId });
  const ref = /^os\b/i.test(shown) ? shown : `OS ${shown}`;
  return [
    `Olá${first ? `, ${first}` : ""}! Aviso do laboratório sobre o óculos de ${input.clientName}.`,
    `${ref}: ${input.category}${input.step ? ` na etapa de ${input.step.toLowerCase()}` : ""}.`,
    `Detalhe: ${input.description}`,
    "O óculos foi separado para assistência (BO). Como seguimos? Pedir nova lente, reparar ou falar com o cliente?",
  ].join("\n");
}

/* ----------------------------------------------------------------------------
 * Rotina do dia
 * ------------------------------------------------------------------------- */
export const ROUTINE_OPEN = [
  { key: "abrir_maquinas", label: "Ligar facetadora, lensômetro e blocador" },
  { key: "abrir_5s", label: "Bancada limpa e ferramentas no lugar (5S)" },
  { key: "abrir_radar", label: "Ver OS atrasadas e em risco no radar" },
  { key: "abrir_bandejas", label: "Separar bandejas por prazo (as que vencem hoje na frente)" },
  { key: "abrir_bo", label: "Conferir BO pendente e cobrar decisões" },
] as const;

export const ROUTINE_CLOSE = [
  { key: "fechar_prontas", label: "Conferir OS prontas e avisar vendedores" },
  { key: "fechar_lentes", label: "Atualizar previsão das lentes que não chegaram" },
  { key: "fechar_ocorrencias", label: "Registrar ocorrências do dia na etapa certa" },
  { key: "fechar_5s", label: "Limpar facetadora e organizar a bancada (5S)" },
  { key: "fechar_maquinas", label: "Desligar máquinas" },
] as const;
