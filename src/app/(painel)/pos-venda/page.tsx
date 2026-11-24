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
        title="Pós-venda"
        description="Cinco dias depois da entrega, confira se o cliente se adaptou bem aos óculos."
      />
      <ClientFollowupPanel rows={rows} nowIso={new Date().toISOString()} />
    </div>
  );
}
