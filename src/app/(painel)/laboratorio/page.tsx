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

  return (
    <OrderScreen
      title={filters.status && STATUS_LABEL[filters.status as OrderStatus] ? STATUS_LABEL[filters.status as OrderStatus] : "Laboratório"}
      description={filters.status ? `Somente OS em ${STATUS_LABEL[filters.status as OrderStatus] ?? filters.status}.` : "Ordens recebidas, fila de lentes e liberação para montagem. Lista e Kanban usam os mesmos registros."}
      basePath="/laboratorio"
      detailPath="/laboratorio"
      orders={orders}
      count={count}
      page={page}
      pageSize={pageSize}
      filters={filters}
      laboratories={catalogs.laboratories}
      role={session.role}
      error={error ?? catalogs.errors[0] ?? null}
      tabCounts={tabCounts}
      wipLimits={((catalogs.settings.lean ?? {}) as { wip?: Record<string, number> }).wip}
    />
  );
}
