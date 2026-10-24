import { OrderForm } from "@/components/order-form";
import { PageHeading } from "@/components/shell";
import { Panel } from "@/components/ui";
import { loadOrderDetail } from "@/server/order-detail";
import { loadCatalogs } from "@/server/queries";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, catalogs] = await Promise.all([loadOrderDetail(id), loadCatalogs()]);
  return (
    <div>
      <PageHeading title={`Editar ${detail.order.number}`} description="O número e o histórico de status permanecem. A alteração fica na auditoria." />
      <Panel className="p-4">
        <OrderForm laboratories={catalogs.laboratories} sellers={catalogs.sellers} stores={catalogs.stores} sellerLinks={catalogs.sellerLinks} order={detail.order} />
      </Panel>
    </div>
  );
}
