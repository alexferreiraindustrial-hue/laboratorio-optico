// Leitura do "bipe": aceita o número da OS (código de barras) ou o link do QR Code.

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export type ScanTarget = { id: string; ref?: never } | { ref: string; id?: never };

export function parseScanCode(raw: string): ScanTarget | null {
  const text = raw.replace(/[\r\n\t]+/g, "").trim();
  if (!text) return null;
  const uuid = text.match(UUID);
  if (uuid && (/\/(laboratorio|montagem|lentes|entrega|assistencia)\b|[?&]os=/.test(text) || uuid[0].length === text.length)) return { id: uuid[0].toLowerCase() };
  if (text.length > 60) return null;
  return { ref: text };
}

/** Ações do modo bipe. Cada uma usa uma ação que o sistema já tem. */
export const SCAN_ACTIONS = {
  lente: { label: "Lente chegou", hint: "Vai para a bancada (aguardando montagem)", from: ["aguardando_lentes"] },
  pronto: { label: "Ficou pronto", hint: "Montagem concluída, vai para a gaveta", from: ["aguardando_montagem", "em_montagem", "em_conferencia"] },
  medico: { label: "Foi para o médico", hint: "Conferência médica", from: ["em_montagem", "pronto"] },
  voltou: { label: "Voltou do médico", hint: "Liberado e pronto para entregar", from: ["em_conferencia"] },
  entregue: { label: "Entregue ao cliente", hint: "Começa o pós-venda de 5 dias", from: ["pronto", "entregue"] },
} as const;

export type ScanAction = keyof typeof SCAN_ACTIONS;

/** Mensagem clara quando a OS não está na etapa certa para essa ação (antes de chamar o servidor). */
export function scanBlockReason(action: ScanAction, order: { status: string; medicalRequired?: boolean | null; medicalApproved?: string | null }, statusLabel: (status: string) => string) {
  const waiting = order.status === "em_conferencia" && Boolean(order.medicalRequired) && !order.medicalApproved;
  if (action === "pronto" && waiting) return "Está no médico. Use \"Voltou do médico\".";
  if (action === "voltou" && order.status === "em_conferencia" && !waiting) return "Não está aguardando retorno do médico.";
  if (action === "entregue" && order.status === "entregue") return null;
  if (!(SCAN_ACTIONS[action].from as readonly string[]).includes(order.status)) return `Está em "${statusLabel(order.status)}".`;
  return null;
}
