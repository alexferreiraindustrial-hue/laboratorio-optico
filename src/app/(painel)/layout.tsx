import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { QUEUE_STATUSES } from "@/lib/domain/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { requireProfile } from "@/server/session";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/");
  const { profile, supabase } = await requireProfile();
  const [settings, unread, open, bo, lensLate] = await Promise.all([
    supabase.from("system_settings").select("value").eq("key", "operations").maybeSingle(),
    supabase.from("order_messages").select("id", { count: "exact", head: true }).eq("status", "novo"),
    supabase.from("service_orders").select("id", { count: "exact", head: true }).in("status", QUEUE_STATUSES),
    supabase.from("quality_occurrences").select("id", { count: "exact", head: true }).in("status", ["aberta", "em_tratamento"]),
    supabase
      .from("service_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "aguardando_lentes")
      .lt("lens_expected_at", new Date().toISOString()),
  ]);
  const operations = (settings.data?.value ?? {}) as { org_name?: string };
  const orgName = operations.org_name || "Laboratório Óptico";
  return (
    <Shell name={profile.full_name} role={profile.role} orgName={orgName} unread={unread.count ?? 0} openOrders={open.count ?? 0} boOpen={bo.count ?? 0} lensLate={lensLate.count ?? 0}>
      {children}
    </Shell>
  );
}
