import { ScanStation } from "@/components/scan-station";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Caixa da produção · Lab Gold" };

export default async function BipePage() {
  const { role } = await requireProfile();
  return <ScanStation role={role} />;
}
