import { notFound } from "next/navigation";
import { SellerForm } from "@/components/party-forms";
import { PageHeading } from "@/components/shell";
import { Panel } from "@/components/ui";
import { requireProfile } from "@/server/session";

export default async function EditSellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProfile();
  const [{ data: seller }, { data: stores }, { data: links }] = await Promise.all([
    supabase.from("sellers").select("*").eq("id", id).maybeSingle(),
    supabase.from("stores").select("id, trade_name").order("trade_name"),
    supabase.from("seller_stores").select("store_id").eq("seller_id", id),
  ]);
  if (!seller) notFound();
  return (
    <div>
      <PageHeading title="Editar vendedor" description={seller.public_code} />
      <Panel className="p-4">
        <SellerForm seller={seller} stores={stores ?? []} selected={(links ?? []).map((link) => link.store_id)} />
      </Panel>
    </div>
  );
}
