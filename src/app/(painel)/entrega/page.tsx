import { QuickLaunch } from "@/components/quick-launch";
import { PageHeading } from "@/components/shell";
import { loadCatalogs } from "@/server/queries";
import { requireProfile } from "@/server/session";

export default async function EntregaPage() {
  const [{ role }, catalogs] = await Promise.all([requireProfile(), loadCatalogs()]);
  return (
    <div className="flex flex-col gap-1">
      <PageHeading
        title="Saída e entrega"
        description="Bipe as OS prontas que estão saindo do laboratório para o vendedor ou a loja. O vendedor vê a OS como entregue no link de acompanhamento."
      />
      <QuickLaunch
        role={role}
        laboratories={catalogs.laboratories}
        sellers={catalogs.sellers}
        stores={catalogs.stores}
        sellerLinks={catalogs.sellerLinks}
        initialMode="saida"
      />
    </div>
  );
}
