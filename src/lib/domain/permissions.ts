import type { AppRole } from "./constants";

export type Capability =
  | "orders.write"
  | "orders.status"
  | "orders.cancel"
  | "orders.deliver"
  | "assembly.write"
  | "quality.write"
  | "stock.write"
  | "stock.consume"
  | "stock.exception"
  | "settings.write"
  | "users.manage"
  | "attachments.delete_any"
  | "parties.write"
  | "portal.manage"
  | "messages.reply";

const MATRIX: Record<AppRole, Capability[]> = {
  admin: [
    "orders.write",
    "orders.status",
    "orders.cancel",
    "orders.deliver",
    "assembly.write",
    "quality.write",
    "stock.write",
    "stock.consume",
    "stock.exception",
    "settings.write",
    "users.manage",
    "attachments.delete_any",
    "parties.write",
    "portal.manage",
    "messages.reply",
  ],
  gestor: [
    "orders.write",
    "orders.status",
    "orders.cancel",
    "orders.deliver",
    "assembly.write",
    "quality.write",
    "stock.write",
    "stock.consume",
    "stock.exception",
    "settings.write",
    "attachments.delete_any",
    "parties.write",
    "portal.manage",
    "messages.reply",
  ],
  montador: [
    "orders.write",
    "orders.status",
    "assembly.write",
    "quality.write",
    "stock.consume",
    "parties.write",
    "messages.reply",
  ],
  estoquista: ["stock.write", "stock.consume"],
  consulta: [],
};

export function can(role: AppRole | null | undefined, capability: Capability) {
  if (!role) return false;
  return MATRIX[role].includes(capability);
}

export function isReadOnly(role: AppRole | null | undefined) {
  return role === "consulta" || !role;
}
