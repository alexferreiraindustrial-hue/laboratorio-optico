import { requireProfile } from "@/server/session";
import { redirect } from "next/navigation";
import { loadClientFollowups } from "@/server/client-followup";
import { ClientFollowupPanel } from "@/components/client-followup-panel";
import { PageHeading } from "@/components/shell";
export default async function PosVendaPage() {
  const { role } = await requireProfile();
  if (!["admin", "gestor"].includes(role)) redirect("/inicio");
  const rows = await loadClientFollowups();
  return (
    <div className="grid gap-5">
      <PageHeading
        title="Entrega ao cliente e pós-venda"
        description="Confirme a entrega real e acompanhe a adaptação após cinco dias corridos. Mensagens são preparadas para envio manual."
      />
      <ClientFollowupPanel rows={rows} nowIso={new Date().toISOString()} />
    </div>
  );
}
