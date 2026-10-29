import { STATUS_LABEL, type OrderStatus } from "./constants";
import { visibleOrderNumber } from "./orders";

/**
 * Previsão operacional de cada OS.
 *
 * A ideia é avisar ANTES do atraso: com base no ponto em que a OS está no fluxo,
 * estimamos quanto trabalho ainda falta e comparamos com o prazo prometido.
 * Os tempos são estimativas de bancada (horas corridas) e podem ser ajustados aqui.
 */
export const FORECAST_HOURS = {
  /** Tempo típico até as lentes chegarem e a OS ser liberada para montagem. */
  lensWait: 24,
  /** Fila até alguém pegar a OS na bancada. */
  assemblyQueue: 4,
  /** Cada uma das 5 etapas de montagem. */
  perStep: 0.8,
  /** Retrabalho após uma ocorrência. */
  correction: 4,
  /** Conferência final de qualidade. */
  finalCheck: 0.5,
} as const;

export const TOTAL_STEPS = 5;

export type Risk = "no_prazo" | "atencao" | "risco" | "atrasada" | "sem_prazo" | "pronta" | "entregue" | "cancelada";

export const RISK_LABEL: Record<Risk, string> = {
  no_prazo: "No prazo",
  atencao: "Atenção",
  risco: "Risco de atraso",
  atrasada: "Atrasada",
  sem_prazo: "Sem prazo",
  pronta: "Pronta",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

export const RISK_TONE: Record<Risk, { fg: string; bg: string; dot: string }> = {
  no_prazo: { fg: "#1c6b43", bg: "#e3f4ea", dot: "#23955a" },
  atencao: { fg: "#8a5a00", bg: "#fdf3dc", dot: "#d99a0b" },
  risco: { fg: "#a3261b", bg: "#fdecea", dot: "#d2382b" },
  atrasada: { fg: "#ffffff", bg: "#b42318", dot: "#ffffff" },
  sem_prazo: { fg: "#6e7c7a", bg: "#eef1f3", dot: "#c9d0d4" },
  pronta: { fg: "#1c6b43", bg: "#e3f4ea", dot: "#23955a" },
  entregue: { fg: "#3b4650", bg: "#e6e9ec", dot: "#3b4650" },
  cancelada: { fg: "#6b7680", bg: "#f3f4f6", dot: "#a0a8b0" },
};

/** Percentual de conclusão exibido para equipe, vendedor e loja. */
export function progressPercent(status: OrderStatus, stepsDone = 0): number {
  const done = Math.max(0, Math.min(TOTAL_STEPS, stepsDone));
  switch (status) {
    case "aguardando_lentes":
      return 10;
    case "aguardando_montagem":
      return 25;
    case "em_montagem":
      return Math.min(85, 30 + Math.round((done / TOTAL_STEPS) * 55));
    case "em_correcao":
      return Math.max(45, Math.min(80, 30 + Math.round((done / TOTAL_STEPS) * 55)));
    case "em_conferencia":
      return 90;
    case "pronto":
    case "entregue":
      return 100;
    case "cancelado":
      return 0;
  }
}

/** Horas de trabalho que ainda faltam para a OS ficar pronta. */
export function remainingHours(status: OrderStatus, stepsDone = 0): number {
  const done = Math.max(0, Math.min(TOTAL_STEPS, stepsDone));
  const assembly = (TOTAL_STEPS - done) * FORECAST_HOURS.perStep + FORECAST_HOURS.finalCheck;
  switch (status) {
    case "aguardando_lentes":
      return FORECAST_HOURS.lensWait + FORECAST_HOURS.assemblyQueue + TOTAL_STEPS * FORECAST_HOURS.perStep + FORECAST_HOURS.finalCheck;
    case "aguardando_montagem":
      return FORECAST_HOURS.assemblyQueue + TOTAL_STEPS * FORECAST_HOURS.perStep + FORECAST_HOURS.finalCheck;
    case "em_montagem":
      return assembly;
    case "em_correcao":
      return FORECAST_HOURS.correction + assembly;
    case "em_conferencia":
      return FORECAST_HOURS.finalCheck;
    default:
      return 0;
  }
}

export type Forecast = {
  risk: Risk;
  progress: number;
  /** Quando a OS deve ficar pronta se o ritmo atual se mantiver. */
  projectedReadyAt: Date | null;
  /** Folga em horas entre a previsão e o prazo prometido (negativa = estoura). */
  slackHours: number | null;
  /** Frase curta explicando o diagnóstico. */
  reason: string;
};

export function forecastOrder(input: {
  status: OrderStatus;
  dueAt: string | null;
  stepsDone?: number;
  now?: Date;
}): Forecast {
  const now = input.now ?? new Date();
  const steps = input.stepsDone ?? 0;
  const progress = progressPercent(input.status, steps);

  if (input.status === "entregue") return { risk: "entregue", progress, projectedReadyAt: null, slackHours: null, reason: "Serviço entregue." };
  if (input.status === "cancelado") return { risk: "cancelada", progress, projectedReadyAt: null, slackHours: null, reason: "OS cancelada." };
  if (input.status === "pronto") return { risk: "pronta", progress, projectedReadyAt: null, slackHours: null, reason: "Pronta para retirada." };

  const hours = remainingHours(input.status, steps);
  const projected = new Date(now.getTime() + hours * 36e5);
  if (!input.dueAt) {
    return { risk: "sem_prazo", progress, projectedReadyAt: projected, slackHours: null, reason: "Sem prazo combinado." };
  }

  const due = new Date(input.dueAt);
  const slack = (due.getTime() - projected.getTime()) / 36e5;
  if (due.getTime() < now.getTime()) {
    return { risk: "atrasada", progress, projectedReadyAt: projected, slackHours: slack, reason: "Prazo já vencido." };
  }
  if (slack < 0) {
    const reason =
      input.status === "aguardando_lentes"
        ? "As lentes ainda não chegaram e o prazo não comporta a montagem."
        : `Faltam cerca de ${formatHoursShort(hours)} de trabalho e o prazo vence antes.`;
    return { risk: "risco", progress, projectedReadyAt: projected, slackHours: slack, reason };
  }
  const tight = slack < Math.max(2, hours * 0.5);
  if (tight) {
    return { risk: "atencao", progress, projectedReadyAt: projected, slackHours: slack, reason: `Folga curta: ${formatHoursShort(slack)} de margem.` };
  }
  return { risk: "no_prazo", progress, projectedReadyAt: projected, slackHours: slack, reason: `Margem de ${formatHoursShort(slack)}.` };
}

export function formatHoursShort(hours: number) {
  const abs = Math.abs(hours);
  if (abs < 1) return `${Math.max(1, Math.round(abs * 60))} min`;
  if (abs < 48) return `${Math.round(abs)} h`;
  return `${Math.round(abs / 24)} dias`;
}

/** Linha do tempo simplificada mostrada ao vendedor e à loja. */
export const JOURNEY = ["Recebida", "Lentes", "Montagem", "Conferência", "Pronta", "Entregue"] as const;

/** Índice da etapa atual dentro de JOURNEY (as anteriores estão concluídas). */
export function journeyIndex(status: OrderStatus): number {
  switch (status) {
    case "aguardando_lentes":
      return 1;
    case "aguardando_montagem":
    case "em_montagem":
    case "em_correcao":
      return 2;
    case "em_conferencia":
      return 3;
    case "pronto":
      return 4;
    case "entregue":
      return 5;
    case "cancelado":
      return 0;
  }
}

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatForecastDate(date: Date | string | null) {
  if (!date) return "—";
  return shortDate.format(typeof date === "string" ? new Date(date) : date).replace(".", "");
}

/** Mensagem pronta para o vendedor (WhatsApp ou cópia). */
export function sellerUpdateMessage(input: {
  sellerName?: string | null;
  number: string;
  clientName: string;
  status: OrderStatus;
  dueAt: string | null;
  forecast: Forecast;
  externalOrderId?: string | null;
}) {
  const first = input.sellerName?.trim().split(/\s+/)[0];
  const shown = visibleOrderNumber({ number: input.number, externalOrderId: input.externalOrderId });
  const extra =
    input.externalOrderId && input.externalOrderId.trim() !== shown ? ` (pedido ${input.externalOrderId.trim()})` : "";
  const lines = [
    `Olá${first ? `, ${first}` : ""}! Atualização do laboratório:`,
    `${/^os\b/i.test(shown) ? "" : "OS "}${shown}${extra} · ${input.clientName}`,
    `Situação: ${STATUS_LABEL[input.status]} — ${input.forecast.progress}% concluído.`,
  ];
  switch (input.forecast.risk) {
    case "pronta":
      lines.push("✅ Está pronta para retirada.");
      break;
    case "risco":
    case "atrasada":
      lines.push(
        `⚠️ Pode não ficar pronta no prazo combinado (${formatForecastDate(input.dueAt)}). Nova estimativa: ${formatForecastDate(input.forecast.projectedReadyAt)}. Já estamos priorizando.`,
      );
      break;
    case "atencao":
      lines.push(`Prazo apertado, mas seguimos para entregar até ${formatForecastDate(input.dueAt)}.`);
      break;
    case "no_prazo":
      lines.push(`Previsão mantida: ${formatForecastDate(input.dueAt)}.`);
      break;
    default:
      break;
  }
  return lines.join("\n");
}

/** Link do WhatsApp com a mensagem já preenchida. Retorna null sem telefone válido. */
export function whatsappLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
