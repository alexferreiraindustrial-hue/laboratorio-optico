// Auditoria do laboratório: comparar onde a OS está no sistema com onde ela foi encontrada
// e achar o caminho para corrigir usando só as operações que o banco já aceita.

export const AUDIT_POSITIONS = {
  aguardando_lentes: "Aguardando lentes",
  vta: "Lente chegou · aguardando armação (VTA)",
  aguardando_montagem: "Aguardando montagem",
  em_montagem: "Em montagem",
  em_conferencia: "Conferência / médico",
  pronto: "Pronto (gaveta)",
} as const;
export type AuditPosition = keyof typeof AUDIT_POSITIONS;
export const AUDIT_ORDER = Object.keys(AUDIT_POSITIONS) as AuditPosition[];
/** Etapas que contam como "no laboratório" na auditoria. */
export const AUDIT_OPEN_STATUSES = ["aguardando_lentes", "aguardando_montagem", "em_montagem", "em_correcao", "em_conferencia", "pronto"];

export type AuditOrder = { status: string; frame_state?: string | null; lens_arrived_at?: string | null };

/** Onde a OS está segundo o sistema. Em correção conta como bancada (em montagem). */
export function auditPositionOf(order: AuditOrder): AuditPosition | null {
  switch (order.status) {
    case "aguardando_lentes": return order.frame_state === "vta" && order.lens_arrived_at ? "vta" : "aguardando_lentes";
    case "em_correcao": return "em_montagem";
    case "aguardando_montagem": case "em_montagem": case "em_conferencia": case "pronto": return order.status;
    default: return null;
  }
}

export type AuditStep =
  | { kind: "lente" }            // receive_order_lenses
  | { kind: "vta" }              // configure_order_operations(vta) + receive_order_lenses
  | { kind: "armacao" }          // receive_order_frame
  | { kind: "status"; to: string } // change_order_status
  | { kind: "reposicao"; to: "aguardando_lentes" | "vta" | "aguardando_montagem" | "em_montagem" }; // reposition_order (função nova)

type State = { status: string; vta: boolean; lens: boolean };
const key = (s: State) => `${s.status}|${s.vta ? 1 : 0}|${s.status === "aguardando_lentes" && s.lens ? 1 : 0}`;
const position = (s: State) => auditPositionOf({ status: s.status, frame_state: s.vta ? "vta" : "unknown", lens_arrived_at: s.lens ? "x" : null });

function moves(s: State): { step: AuditStep; next: State }[] {
  const out: { step: AuditStep; next: State }[] = [];
  const to = (status: string, extra: Partial<State> = {}) => ({ ...s, status, ...extra });
  switch (s.status) {
    case "aguardando_lentes":
      if (s.vta && !s.lens) out.push({ step: { kind: "lente" }, next: to("aguardando_lentes", { lens: true }) });
      if (s.vta && s.lens) out.push({ step: { kind: "armacao" }, next: to("aguardando_montagem", { vta: false }) });
      if (!s.vta) {
        out.push({ step: { kind: "lente" }, next: to("aguardando_montagem", { lens: true }) });
        out.push({ step: { kind: "vta" }, next: to("aguardando_lentes", { vta: true, lens: true }) });
      }
      break;
    case "aguardando_montagem":
      for (const status of ["em_montagem", "pronto", "aguardando_lentes"]) out.push({ step: { kind: "status", to: status }, next: to(status) });
      break;
    case "em_montagem":
      for (const status of ["pronto", "em_conferencia", "aguardando_montagem"]) out.push({ step: { kind: "status", to: status }, next: to(status) });
      break;
    case "em_correcao":
      out.push({ step: { kind: "status", to: "em_montagem" }, next: to("em_montagem") });
      break;
    case "em_conferencia":
      out.push({ step: { kind: "status", to: "pronto" }, next: to("pronto") });
      break;
    case "pronto":
      out.push({ step: { kind: "status", to: "em_conferencia" }, next: to("em_conferencia") });
      break;
  }
  return out;
}

const REPOSITION_FROM = ["pronto", "aguardando_lentes", "aguardando_montagem", "em_montagem"];
const REPOSITION_TO = ["aguardando_lentes", "vta", "aguardando_montagem", "em_montagem"];

/**
 * Passos para levar a OS de onde o sistema diz até onde ela foi encontrada.
 * [] = já confere. null = não há caminho (ex.: OS entregue ou cancelada).
 * Usa até 3 operações do fluxo normal; senão recorre à função de reposição (gestor).
 */
export function planAudit(order: AuditOrder, found: AuditPosition): AuditStep[] | null {
  const start: State = { status: order.status, vta: order.frame_state === "vta", lens: Boolean(order.lens_arrived_at) };
  if (!auditPositionOf(order)) return null;
  if (position(start) === found) return [];
  const seen = new Set([key(start)]);
  let frontier: { state: State; path: AuditStep[] }[] = [{ state: start, path: [] }];
  for (let depth = 0; depth < 3 && frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const { state, path } of frontier) {
      for (const move of moves(state)) {
        if (seen.has(key(move.next))) continue;
        seen.add(key(move.next));
        const route = [...path, move.step];
        if (position(move.next) === found) return route;
        next.push({ state: move.next, path: route });
      }
    }
    frontier = next;
  }
  if (REPOSITION_FROM.includes(order.status) && REPOSITION_TO.includes(found)) return [{ kind: "reposicao", to: found as "aguardando_lentes" | "vta" | "aguardando_montagem" | "em_montagem" }];
  return null;
}

/** Resumo curto dos passos para mostrar no cupom. */
export function describeAudit(steps: AuditStep[]) {
  const text = steps.map((step) => {
    switch (step.kind) {
      case "lente": return "lente chegou";
      case "vta": return "VTA";
      case "armacao": return "armação chegou";
      case "status": return step.to.replace(/_/g, " ");
      case "reposicao": return `corrigido para ${step.to === "vta" ? "VTA" : step.to.replace(/_/g, " ")}`;
    }
  });
  return text.join(" → ");
}
