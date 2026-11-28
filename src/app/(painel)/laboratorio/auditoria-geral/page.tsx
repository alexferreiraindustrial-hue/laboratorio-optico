import Link from "next/link";
import { GeneralAuditPanel } from "@/components/general-audit-panel";
import { PageHeading } from "@/components/shell";
import { loadGeneralAudit } from "@/server/general-audit";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Auditoria geral" };

export default async function AuditoriaGeralPage() {
  const [{ role }, data] = await Promise.all([requireProfile(), loadGeneralAudit()]);
  return (
    <div className="grid gap-3">
      <PageHeading title="Auditoria geral" description="Confira fisicamente todas as OS. O que não for bipado vai para off: sai da operação, mas os dados ficam guardados." />
      <p className="text-sm"><Link href="/laboratorio/auditoria" className="font-semibold text-[var(--link)]">Imprimir a folha de auditoria (QR e código de barras)</Link></p>
      <GeneralAuditPanel data={data} canManage={role === "admin" || role === "gestor"} />
    </div>
  );
}
