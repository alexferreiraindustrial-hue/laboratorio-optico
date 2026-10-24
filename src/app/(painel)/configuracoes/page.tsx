import { SettingsScreen } from "@/components/settings-screen";
import { PageHeading } from "@/components/shell";
import { requireProfile } from "@/server/session";

export default async function SettingsPage() {
  const { supabase, role } = await requireProfile();
  const [labs, sellers, categories, goals, settings, profiles, audit] = await Promise.all([
    supabase.from("laboratories").select("*").order("name"),
    supabase.from("sellers").select("*").order("name"),
    supabase.from("quality_categories").select("*").order("sort_order"),
    supabase.from("production_goals").select("*").order("valid_from", { ascending: false }),
    supabase.from("system_settings").select("*"),
    supabase.from("profiles").select("id, full_name, role, active").order("full_name"),
    supabase.from("audit_logs").select("id, action, entity, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const settingMap = Object.fromEntries((settings.data ?? []).map((item) => [item.key, item.value]));

  return (
    <div>
      <PageHeading
        title="Configurações"
        description="Parâmetros operacionais gravados no banco. O perfil Consulta não altera registros."
      />
      <SettingsScreen
        role={role}
        laboratories={labs.data ?? []}
        sellers={sellers.data ?? []}
        categories={categories.data ?? []}
        goals={goals.data ?? []}
        settings={settingMap}
        profiles={profiles.data ?? []}
        audit={audit.data ?? []}
        auditError={audit.error?.message ?? null}
      />
    </div>
  );
}
