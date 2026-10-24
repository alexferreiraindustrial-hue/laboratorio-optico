import type { AppRole, OrderStatus } from "./constants";
import { can } from "./permissions";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  aguardando_lentes: ["aguardando_montagem", "cancelado"],
  aguardando_montagem: ["em_montagem", "aguardando_lentes", "cancelado"],
  em_montagem: [
    "em_correcao",
    "em_conferencia",
    "aguardando_montagem",
    "cancelado",
  ],
  em_correcao: ["em_montagem", "cancelado"],
  em_conferencia: ["pronto", "em_correcao", "cancelado"],
  pronto: ["entregue", "em_correcao"],
  entregue: [],
  cancelado: [],
};

const ASSEMBLER_TARGETS = new Set<OrderStatus>([
  "aguardando_montagem",
  "em_montagem",
  "em_correcao",
  "em_conferencia",
  "pronto",
]);

export function allowedTargets(from: OrderStatus, role: AppRole): OrderStatus[] {
  return TRANSITIONS[from].filter((to) => canTransition(from, to, role));
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: AppRole,
): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  if (!can(role, "orders.status")) return false;
  if (to === "cancelado" && !can(role, "orders.cancel")) return false;
  if (to === "entregue" && !can(role, "orders.deliver")) return false;
  if (role === "montador" && !ASSEMBLER_TARGETS.has(to)) return false;
  if (role === "montador" && from === "aguardando_lentes") return false;
  return true;
}

export function transitionError(
  from: OrderStatus,
  to: OrderStatus,
  role: AppRole,
): string | null {
  if (from === to) return "A ordem já está neste status.";
  if (!TRANSITIONS[from].includes(to)) {
    return "Esta mudança de status não faz parte do fluxo operacional.";
  }
  if (!canTransition(from, to, role)) {
    return "Seu perfil não pode realizar esta movimentação.";
  }
  return null;
}
