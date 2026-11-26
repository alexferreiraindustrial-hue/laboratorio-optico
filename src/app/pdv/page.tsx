import { redirect } from "next/navigation";
import { PdvApp } from "@/components/pdv-app";
import { isSupabaseConfigured } from "@/lib/env";
import { loadCatalogs } from "@/server/queries";
import { requireProfile } from "@/server/session";

export const metadata = { title: "PDV da produção · Lab Gold" };

/** Tela cheia de produção, fora do menu do sistema: bipe, lançamento e radar de prazos. */
export default async function PdvPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const [{ profile, supabase }, catalogs] = await Promise.all([requireProfile(), loadCatalogs()]);
  const { data } = await supabase.from("system_settings").select("value").eq("key", "operations").maybeSingle();
  const orgName = ((data?.value ?? {}) as { org_name?: string }).org_name || "Laboratório Óptico";
  return (
    <PdvApp
      role={profile.role}
      name={profile.full_name}
      orgName={orgName}
      laboratories={catalogs.laboratories}
      sellers={catalogs.sellers}
      stores={catalogs.stores}
      sellerLinks={catalogs.sellerLinks}
    />
  );
}
