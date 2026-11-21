import { Zap } from "lucide-react";
import Link from "next/link";
import { OrderForm } from "@/components/order-form";
import { PageHeading } from "@/components/shell";
import { Panel } from "@/components/ui";
import { loadCatalogs } from "@/server/queries";

export default async function NovaOsPage() {
  const { laboratories, sellers, stores, sellerLinks } = await loadCatalogs();
  return (
    <div className="flex flex-col gap-1">
      <PageHeading title="Nova ordem de serviço" description="O número é gerado pelo banco e não se repete." />
      <Link
        href="/laboratorio/rapido"
        className="mb-5 flex items-center gap-3.5 rounded-xl border border-[var(--focus)]/30 bg-[var(--accent-soft)] px-5 py-4 transition-colors hover:border-[var(--focus)]"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-white">
          <Zap size={19} />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-[15px] font-semibold text-[var(--link)]">Com pressa? Use o lançamento rápido</span>
          <span className="text-[13px] text-[var(--muted)]">Só o número da OS, só o nome ou os dois — várias de uma vez, inclusive com leitor de código.</span>
        </span>
        <span className="hidden text-[13px] font-semibold text-[var(--link)] sm:block">Abrir →</span>
      </Link>
      <Panel className="p-5">
        <OrderForm laboratories={laboratories} sellers={sellers} stores={stores} sellerLinks={sellerLinks} />
      </Panel>
    </div>
  );
}
