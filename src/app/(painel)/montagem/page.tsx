import { BenchBoard, type BenchOrder } from "@/components/bench-board";
import { OrderScreen } from "@/components/order-screen";
import { loadCatalogs, loadOrders, type OrderFilters } from "@/server/queries";
import { requireProfile } from "@/server/session";

const assemblyStatuses = ["aguardando_montagem", "em_montagem", "em_correcao", "em_conferencia"] as const;

export default async function MontagemPage({ searchParams }: { searchParams: Promise<OrderFilters & { view?: string }> }) {
  const filters = await searchParams;

  if (filters.view === "lista") {
    const [{ orders, count, page, pageSize, error }, catalogs, session] = await Promise.all([
      loadOrders(filters, { statuses: filters.status ? undefined : [...assemblyStatuses] }),
      loadCatalogs(),
      requireProfile(),
    ]);
    return (
      <OrderScreen
        title="Bancada de montagem"
        description="Visão em lista das OS liberadas ou em execução. Volte para a bancada para trabalhar etapa por etapa."
        basePath="/montagem"
        detailPath="/montagem"
        orders={orders}
        count={count}
        page={page}
        pageSize={pageSize}
        filters={filters}
        laboratories={catalogs.laboratories}
        role={session.role}
        error={error}
        statuses={[...assemblyStatuses]}
      />
    );
  }

  const { supabase, role } = await requireProfile();
  const { data: orders, error } = await supabase
    .from("orders_enriched")
    .select("id, number, client_name, seller_name, store_name, external_order_id, due_at, status, priority")
    .in("status", [...assemblyStatuses])
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  const ids = (orders ?? []).map((order) => order.id as string);
  const steps: { order_id: string; step_key: string; status: string; started_at: string | null; assignee_id: string | null }[] = [];
  for (let index = 0; index < ids.length; index += 150) {
    const { data } = await supabase
      .from("assembly_steps")
      .select("order_id, step_key, status, started_at, assignee_id")
      .in("order_id", ids.slice(index, index + 150));
    steps.push(...((data ?? []) as typeof steps));
  }
  const assigneeIds = [...new Set(steps.map((step) => step.assignee_id).filter(Boolean))] as string[];
  const { data: people } = assigneeIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", assigneeIds)
    : { data: [] as { id: string; full_name: string }[] };
  const names = new Map((people ?? []).map((person) => [person.id as string, person.full_name as string]));

  const bench: BenchOrder[] = (orders ?? []).map((order) => ({
    id: order.id as string,
    number: order.number as string,
    clientName: order.client_name as string,
    sellerName: (order.seller_name as string | null) ?? null,
    storeName: (order.store_name as string | null) ?? null,
    externalOrderId: (order.external_order_id as string | null) ?? null,
    dueAt: (order.due_at as string | null) ?? null,
    status: order.status as BenchOrder["status"],
    urgent: order.priority === "critica",
    steps: steps
      .filter((step) => step.order_id === order.id)
      .map((step) => ({
        key: step.step_key as BenchOrder["steps"][number]["key"],
        status: step.status as BenchOrder["steps"][number]["status"],
        startedAt: step.started_at,
        assignee: step.assignee_id ? (names.get(step.assignee_id) ?? null) : null,
      })),
  }));

  return <BenchBoard orders={bench} role={role} error={error?.message ?? null} nowIso={new Date().toISOString()} />;
}
