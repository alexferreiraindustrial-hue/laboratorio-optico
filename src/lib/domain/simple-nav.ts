import type { AppRole } from "./constants";
import { can } from "./permissions";

/** Telas do modo simples, na ordem do caminho do óculos no laboratório. */
export const SIMPLE_NAV = [
  { href: "/inicio", label: "Início", hint: "Tela com os botões principais" },
  { href: "/laboratorio/rapido", label: "Lançar OS", hint: "Chegou uma OS nova" },
  { href: "/lentes", label: "Lentes", hint: "Chegou lente / o que falta" },
  { href: "/montagem", label: "Montagem", hint: "Montar e conferir" },
  { href: "/entrega", label: "Entrega", hint: "Óculos saindo pronto" },
  { href: "/pdv", label: "PDV", hint: "Bipar, lançar e ver prazos" },
] as const;

export type SimpleHref = (typeof SIMPLE_NAV)[number]["href"];

/** Mostra no modo simples só o que o perfil consegue fazer (o servidor continua validando). */
export function simpleAllowed(role: AppRole, href: string) {
  if (role === "admin" || role === "gestor" || role === "consulta") return true;
  switch (href) {
    case "/inicio":
    case "/lentes":
      return true;
    case "/laboratorio/rapido":
      return can(role, "orders.write") || can(role, "stock.write");
    case "/montagem":
      return can(role, "assembly.write");
    case "/entrega":
      return can(role, "orders.deliver");
    case "/pdv":
      return can(role, "orders.status");
    default:
      return false;
  }
}

/** A simplified menu must not hide the management overview behind the old home. */
export function hasProductionOverview(role: AppRole) {
  return role === "admin" || role === "gestor" || role === "consulta";
}
