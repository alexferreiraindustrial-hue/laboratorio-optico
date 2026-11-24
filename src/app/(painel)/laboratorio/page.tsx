import { LensForecastEditor } from "@/components/lens-forecast-editor";
import { OrderDrawer } from "@/components/order-drawer";
import { OrderForm } from "@/components/order-form";
import { OrderWorkspace } from "@/components/order-workspace";
import { loadOrderDetail } from "@/server/order-detail";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { can } from "@/lib/domain/permissions";
import { OrderScreen } from "@/components/order-screen";
import { STATUS_LABEL, type OrderStatus } from "@/lib/domain/constants";
import { loadCatalogs, loadOrders, loadOrderTabCounts, type OrderFilters } from "@/server/queries";
import { requireProfile } from "@/server/session";

export default async function LaboratorioPage({
  searchParams,
}: {
  searchParams: Promise<OrderFilters>;
}) {
  const raw = await searchParams;
  const filters: OrderFilters = !raw.tab && !raw.status && !raw.q ? { ...raw, tab: "andamento" } : raw;
  const [{ orders, count, page, pageSize, error }, catalogs, session, tabCounts] = await Promise.all([
    loadOrders(filters),
    loadCatalogs(),
    requireProfile(),
    loadOrderTabCounts(),
  ]);

  const detail = raw.os && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(raw.os) ? await loadOrderDetail(raw.os) : null;
  const closeParams = new URLSearchParams(Object.entries(raw).filter(([key, value]) => key !== "os" && Boolean(value)) as [string, string][]);
  const closeHref = `/laboratorio${closeParams.size ? `?${closeParams}` : ""}`;
  return (
    <>
    <OrderScreen
      title={filters.status && STATUS_LABEL[filters.status as OrderStatus] ? STATUS_LABEL[filters.status as OrderStatus] : "Fila de produção"}
      description={filters.status ? `Somente OS em ${STATUS_LABEL[filters.status as OrderStatus] ?? filters.status}.` : "Ordens recebidas, fila de lentes e liberação para montagem. Lista e Kanban usam os mesmos registros."}
      basePath="/laboratorio"
      detailPath="/laboratorio"
      orders={orders}
      count={count}
      page={page}
      pageSize={pageSize}
      filters={filters}
      laboratories={catalogs.laboratories}
      sellers={catalogs.sellers}
      role={session.role}
      error={error ?? catalogs.errors[0] ?? null}
      tabCounts={tabCounts}
      wipLimits={((catalogs.settings.lean ?? {}) as { wip?: Record<string, number> }).wip}
    />
    {detail ? <OrderDrawer key={detail.order.id} client={detail.order.client_name} title={`OS ${visibleOrderNumber(detail.order)}`} closeHref={closeHref} detailHref={`/laboratorio/${detail.order.id}`}
      editor={can(session.role, "orders.write") ? <><OrderForm laboratories={catalogs.laboratories} sellers={catalogs.sellers} stores={catalogs.stores} sellerLinks={catalogs.sellerLinks} order={detail.order} /><LensForecastEditor orderId={detail.order.id} expectedAt={detail.order.lens_expected_at} supplierRef={detail.order.lens_supplier_ref} /></> : undefined}
      workspace={<OrderWorkspace {...detail} mode="laboratorio" />}
    /> : null}
    </>
  );
}
