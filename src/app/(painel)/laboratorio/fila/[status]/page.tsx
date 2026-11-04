import { notFound } from "next/navigation";
import { OrderScreen } from "@/components/order-screen";
import { QUEUE_STATUSES, STATUS_LABEL, type OrderStatus } from "@/lib/domain/constants";
import { loadCatalogs, loadOrders, loadOrderTabCounts } from "@/server/queries";
import { requireProfile } from "@/server/session";

export default async function FilaStatusPage({
  params,
}: {
  params: Promise<{ status: string }>;
}) {
  const { status } = await params;
  if (!QUEUE_STATUSES.includes(status as OrderStatus)) notFound();
  const filters = { status };
  const [{ orders, count, page, pageSize, error }, catalogs, session, tabCounts] = await Promise.all([
    loadOrders(filters, { pageSize: 400 }),
    loadCatalogs(),
    requireProfile(),
    loadOrderTabCounts(),
  ]);

  return (
    <OrderScreen
      title={STATUS_LABEL[status as OrderStatus]}
      description={`Somente OS em ${STATUS_LABEL[status as OrderStatus]}.`}
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
