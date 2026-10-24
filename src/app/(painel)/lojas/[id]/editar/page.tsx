import { notFound } from "next/navigation";
import { StoreForm } from "@/components/party-forms";
import { PageHeading } from "@/components/shell";
import { Panel } from "@/components/ui";
import type { Store } from "@/lib/types";
import { requireProfile } from "@/server/session";

export default async function EditStorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProfile();
  const { data } = await supabase.from("stores").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <div>
      <PageHeading title="Editar loja" description={data.public_code} />
      <Panel className="p-4"><StoreForm store={data as Store} /></Panel>
    </div>
  );
}
