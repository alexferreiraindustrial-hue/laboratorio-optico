export type ClientDelivery = {
  id: string;
  order_id: string;
  client_delivered_at: string;
  followup_due_at: string;
  client_phone: string | null;
  contacted_at: string | null;
  outcome: string | null;
  feedback_note: string | null;
  updated_at: string;
};
export type ClientFollowupRow = ClientDelivery & {
  number: string;
  client_name: string;
  seller_name: string | null;
  seller_id: string | null;
};
export function feedbackPending(row: ClientDelivery, now: Date) {
  return !row.contacted_at && Date.parse(row.followup_due_at) <= now.getTime();
}
export function matchesFollowup(
  row: ClientFollowupRow,
  seller: string,
  mode: string,
  now: Date,
) {
  if (seller && row.seller_id !== seller) return false;
  switch (mode) {
    case "all":
      return true;
    case "pending":
      return feedbackPending(row, now);
    case "await":
      return (
        !row.contacted_at && Date.parse(row.followup_due_at) > now.getTime()
      );
    case "help":
      return row.outcome === "precisa_ajuda" && !isCorrection(row);
    case "correction":
      return isCorrection(row);
    case "phone":
      return hasPhone(row.client_phone);
    case "contacted":
      return !!row.contacted_at;
    default:
      return false;
  }
}
export const STORE_NAME = "Gold Finger Cruzeiro";
/** Marca gravada no início da observação quando o contato gerou correção (sem mudar o banco). */
export const CORRECTION_MARK = "[Gerou correção]";
export function isCorrection(row: Pick<ClientDelivery, "outcome" | "feedback_note">) {
  return row.outcome === "precisa_ajuda" && (row.feedback_note ?? "").startsWith(CORRECTION_MARK);
}
export function stripCorrection(note: string | null) {
  const text = note ?? "";
  return text.startsWith(CORRECTION_MARK) ? text.slice(CORRECTION_MARK.length).trim() : text;
}
export function hasPhone(phone: string | null) {
  return (phone ?? "").replace(/\D/g, "").length >= 10;
}
export function feedbackMessage(client: string, number?: string) {
  const first = client.trim().split(/\s+/)[0] || client;
  const os = number ? ` (OS ${number})` : "";
  return `Olá, ${first}! Aqui é da ${STORE_NAME}. Faz alguns dias que você retirou seus óculos${os} e queremos saber como está a adaptação. Está enxergando bem e se sente confortável? Se precisar de algum ajuste, é só responder esta mensagem que a gente resolve.`;
}

export type FollowupMetrics = {
  delivered: number;
  contacted: number;
  ok: number;
  adjust: number;
  correction: number;
  noAnswer: number;
  waitingReply: number;
  toContact: number;
  answered: number;
};

/** Indicadores do pós-venda das entregas a partir de `from` (todas quando nulo). */
export function followupMetrics(rows: ClientFollowupRow[], now: Date, from: Date | null): FollowupMetrics {
  const list = from ? rows.filter((row) => Date.parse(row.client_delivered_at) >= from.getTime()) : rows;
  const m: FollowupMetrics = { delivered: list.length, contacted: 0, ok: 0, adjust: 0, correction: 0, noAnswer: 0, waitingReply: 0, toContact: 0, answered: 0 };
  for (const row of list) {
    if (row.contacted_at) m.contacted++;
    if (feedbackPending(row, now)) m.toContact++;
    if (row.outcome === "adaptacao_ok") m.ok++;
    else if (isCorrection(row)) m.correction++;
    else if (row.outcome === "precisa_ajuda") m.adjust++;
    else if (row.outcome === "sem_resposta") m.noAnswer++;
    else if (row.outcome === "contato_realizado") m.waitingReply++;
  }
  m.answered = m.ok + m.adjust + m.correction;
  return m;
}

/** Percentual inteiro; "—" quando não há base. */
export function percent(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "—";
}

/** Mesmos indicadores separados por vendedora, da que mais entregou para a que menos entregou. */
export function followupBySeller(rows: ClientFollowupRow[], now: Date, from: Date | null) {
  const groups = new Map<string, { name: string; rows: ClientFollowupRow[] }>();
  for (const row of rows) {
    const key = row.seller_id ?? "-";
    const group = groups.get(key) ?? { name: row.seller_name || "Sem vendedora", rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([id, group]) => ({ id, name: group.name, metrics: followupMetrics(group.rows, now, from) }))
    .filter((item) => item.metrics.delivered > 0)
    .sort((a, b) => b.metrics.delivered - a.metrics.delivered || a.name.localeCompare(b.name));
}
