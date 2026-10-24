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
        title="Lançamento rápido"
        description="Para o balcão e a bancada: abra, libere e dê saída em OS em segundos, digitando ou com leitor de código."
      >
        <Button variant="secondary" asChild>
          <Link href="/laboratorio/nova">Cadastro completo</Link>
        </Button>
      </PageHeading>
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
