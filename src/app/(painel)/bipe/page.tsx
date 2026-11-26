import { ScanStation } from "@/components/scan-station";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Modo bipe · Lab Gold" };

export default async function BipePage() {
  const { role } = await requireProfile();
  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--link)]">Produção · Leitor</p>
        <h1 className="text-2xl font-semibold">Modo bipe</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">Escolha o que está acontecendo e passe o leitor no código de barras da etiqueta (ou no QR Code). Cada bipe registra na hora, com o mesmo histórico de sempre. Se a OS não estiver na etapa certa, nada muda e aparece o motivo.</p>
      </div>
      <ScanStation role={role} />
    </div>
  );
}
