/** Para onde uma OS pode ser recolocada pelo gestor (função reposition_order no banco). */
export const REPOSITION_LABEL = {
  aguardando_lentes: "Aguardando lentes",
  vta: "Lente chegou · aguardando armação (VTA)",
  aguardando_montagem: "Aguardando montagem",
  em_montagem: "Em montagem",
} as const;
export type RepositionTarget = keyof typeof REPOSITION_LABEL;
export const REPOSITION_TARGETS = Object.keys(REPOSITION_LABEL) as RepositionTarget[];
/** Etapas de onde a OS pode sair por "Corrigir posição". */
export const REPOSITION_FROM = ["pronto", "aguardando_lentes", "aguardando_montagem", "em_montagem"];

export function canReposition(role: string, status: string) {
  return (role === "admin" || role === "gestor") && REPOSITION_FROM.includes(status);
}

/** Posição atual no mesmo vocabulário (para não oferecer o lugar onde a OS já está). */
export function currentPosition(order: { status: string; frame_state?: string | null; lens_arrived_at?: string | null }): RepositionTarget | null {
  if (order.status === "aguardando_lentes") return order.frame_state === "vta" && order.lens_arrived_at ? "vta" : order.lens_arrived_at ? null : "aguardando_lentes";
  if (order.status === "aguardando_montagem" || order.status === "em_montagem") return order.status;
  return null;
}
