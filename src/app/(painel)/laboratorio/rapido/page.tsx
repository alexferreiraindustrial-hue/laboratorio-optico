import {ReadyEntry} from "@/components/ready-entry";
import {can} from "@/lib/domain/permissions";
import Link from "next/link";
import { QuickLaunch } from "@/components/quick-launch";
import { PageHeading } from "@/components/shell";
import { Button } from "@/components/ui";
import { loadCatalogs } from "@/server/queries";
import { requireProfile } from "@/server/session";

export default async function LancamentoRapidoPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const { modo } = await searchParams;
  const [{ role }, catalogs] = await Promise.all([requireProfile(), loadCatalogs()]);
  const initialMode = modo === "saida" || modo === "lentes" ? modo : "entrada";
  return (
    <div className="flex flex-col gap-1">
      <PageHeading
        title="Lançar serviço"
        description="Registre uma OS ou uma manutenção rápida. Escolha o serviço, informe o prazo e salve."
      >
        <Button variant="secondary" asChild>
          <Link href="/laboratorio/nova">Cadastro completo</Link>
        </Button>
      </PageHeading>
      {can(role,"orders.write")&&<ReadyEntry sellers={catalogs.sellers}/>}
      <QuickLaunch
        role={role}
        laboratories={catalogs.laboratories}
        sellers={catalogs.sellers}
        stores={catalogs.stores}
        sellerLinks={catalogs.sellerLinks}
        initialMode={initialMode}
      />
    </div>
  );
}
