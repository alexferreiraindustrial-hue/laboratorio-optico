import { SellerForm } from "@/components/party-forms";
import { PageHeading } from "@/components/shell";
import { Panel } from "@/components/ui";
import { requireProfile } from "@/server/session";

export default async function NewSellerPage() {
  const { supabase } = await requireProfile();
  const { data: stores } = await supabase.from("stores").select("id, trade_name").eq("active", true).order("trade_name");
  return (
    <div>
      <PageHeading title="Novo vendedor" description="O código é gerado pelo banco. Vincule uma ou mais lojas." />
      <Panel className="p-4"><SellerForm stores={stores ?? []} selected={[]} /></Panel>
    </div>
  );
}
