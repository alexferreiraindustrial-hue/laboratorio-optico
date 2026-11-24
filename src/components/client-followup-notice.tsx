import Link from "next/link";
import { requireProfile } from "@/server/session";
export async function ClientFollowupNotice() {
  const { supabase, role } = await requireProfile();
  if (!["admin", "gestor"].includes(role)) return null;
  const { count, error } = await supabase
    .from("client_delivery_followups")
    .select("id", { count: "exact", head: true })
    .is("contacted_at", null)
    .lte("followup_due_at", new Date().toISOString());
  return (
    <Link
      href="/pos-venda"
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--link)]"
    >
      {error
        ? "Conferir pós-venda · atualização indisponível"
        : count
          ? `${count} cliente(s) com acompanhamento de cinco dias pendente`
          : "Entrega ao cliente e acompanhamento de cinco dias"}{" "}
      →
    </Link>
  );
}
