import Link from "next/link";
import { StockCreateForm } from "@/components/stock-board";
import { PageHeading } from "@/components/shell";
import { Button, Panel } from "@/components/ui";
import { can } from "@/lib/domain/permissions";
import { requireProfile } from "@/server/session";

export default async function NovaLentePage({ searchParams }: { searchParams: Promise<{ esf?: string; cil?: string }> }) {
  const { role } = await requireProfile();
  const params = await searchParams;
  return (
    <div className="flex flex-col gap-1">
      <PageHeading
        title="Cadastrar lente no estoque"
        description="Informe o grau e as características. Cada combinação (fabricante, material, índice, tratamento, grau) tem saldo e QR Code próprios. Graus fora da grade viram grau especial automaticamente."
      >
        <Button variant="secondary" asChild>
          <Link href="/estoque">Voltar ao estoque</Link>
        </Button>
      </PageHeading>
      {can(role, "stock.write") ? (
        <Panel className="p-5">
          <p className="text-sm text-[#44524f]">
            Só <strong>esférico</strong> e <strong>cilíndrico</strong> são obrigatórios. Use vírgula ou ponto: <span className="font-mono">-1,25</span>,{" "}
            <span className="font-mono">+0,50</span>, <span className="font-mono">0,00</span>. A quantidade inicial já entra como movimentação de entrada.
          </p>
          <StockCreateForm sphere={params.esf ?? ""} cylinder={params.cil ?? "0,00"} />
        </Panel>
      ) : (
        <Panel className="px-5 py-8 text-center text-sm text-[#6e7c7a]">Seu perfil não cadastra lentes. Peça a um gestor, administrador ou estoquista.</Panel>
      )}
    </div>
  );
}
