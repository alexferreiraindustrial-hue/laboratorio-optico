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
  lente: { label: "Lente chegou", hint: "Vai direto para em montagem (VTA espera a armação)", from: ["aguardando_lentes"] },
  pronto: { label: "Ficou pronto", hint: "Montagem concluída, vai para a gaveta", from: ["aguardando_montagem", "em_montagem", "em_conferencia"] },
  medico: { label: "Foi para o médico", hint: "Conferência médica", from: ["em_montagem", "pronto"] },
  voltou: { label: "Voltou do médico", hint: "Liberado e pronto para entregar", from: ["em_conferencia"] },
  entregue: { label: "Entregue ao cliente", hint: "Começa o pós-venda de 5 dias", from: ["pronto", "entregue"] },
  armacao: { label: "Armação chegou (VTA)", hint: "Cliente trouxe a armação · vai para montagem", from: ["aguardando_lentes"] },
  auditoria: { label: "Auditoria", hint: "Escolha o local e bipe tudo o que está nele · gestor", from: ["aguardando_lentes", "aguardando_montagem", "em_montagem", "em_correcao", "em_conferencia", "pronto"] },
  corrigir: { label: "Corrigir posição", hint: "Desfazer pronto ou pôr em VTA · gestor", from: ["pronto", "aguardando_lentes", "aguardando_montagem", "em_montagem"] },
} as const;

export type ScanAction = keyof typeof SCAN_ACTIONS;

/** Mensagem clara quando a OS não está na etapa certa para essa ação (antes de chamar o servidor). */
type ScanOrder = { status: string; medicalRequired?: boolean | null; medicalApproved?: string | null; frameState?: string | null; lensArrived?: string | null };

export function scanBlockReason(action: ScanAction, order: ScanOrder, statusLabel: (status: string) => string) {
  if (action === "armacao" && order.status === "aguardando_lentes" && order.frameState !== "vta") return "Não está marcada como VTA (aguardando armação).";
  if (action === "lente" && order.status === "aguardando_lentes" && order.frameState === "vta" && order.lensArrived) return null;
  const waiting = order.status === "em_conferencia" && Boolean(order.medicalRequired) && !order.medicalApproved;
  if (action === "pronto" && waiting) return "Está no médico. Use \"Voltou do médico\".";
  if (action === "voltou" && order.status === "em_conferencia" && !waiting) return "Não está aguardando retorno do médico.";
  if (action === "entregue" && order.status === "entregue") return null;
  if (!(SCAN_ACTIONS[action].from as readonly string[]).includes(order.status)) return `Está em "${statusLabel(order.status)}".`;
  return null;
}

/** A OS já está onde essa ação a deixaria (bipe repetido da mesma etiqueta). */
export function scanAlreadyDone(action: ScanAction, order: ScanOrder) {
  switch (action) {
    case "lente": return order.status === "aguardando_montagem" || order.status === "em_montagem" || (order.status === "aguardando_lentes" && order.frameState === "vta" && Boolean(order.lensArrived));
    case "armacao": return false;
    case "corrigir": return false;
    case "auditoria": return false;
    case "pronto": return order.status === "pronto";
    case "medico": return order.status === "em_conferencia";
    case "voltou": return order.status === "pronto" && Boolean(order.medicalApproved);
    case "entregue": return false;
  }
}
