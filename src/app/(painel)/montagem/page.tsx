import {loadOperations} from "@/server/operations";
import { OrderDrawer } from "@/components/order-drawer";
import { OrderWorkspace } from "@/components/order-workspace";
import { loadOrderDetail } from "@/server/order-detail";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { BenchBoard, type BenchOrder } from "@/components/bench-board";
import { OrderScreen } from "@/components/order-screen";
import { loadCatalogs, loadOrders, type OrderFilters } from "@/server/queries";
import { requireProfile } from "@/server/session";

const assemblyStatuses = ["aguardando_montagem", "em_montagem", "em_correcao", "em_conferencia", "pronto"] as const;

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
      sellers={catalogs.sellers}
        role={session.role}
        error={error}
        statuses={[...assemblyStatuses]}
      />
    );
  }

  const { supabase, role, user } = await requireProfile();
  const { data: orders, error } = await supabase
    .from("orders_enriched")
    .select("id, number, client_name, service_description, seller_name, store_name, laboratory_name, external_order_id, due_at, status, priority, entered_at")
    .in("status", [...assemblyStatuses])
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  const catalogs = await loadCatalogs();
  const ids = (orders ?? []).map((order) => order.id as string);
  const operations=await loadOperations(supabase,ids);
  let boardError = error?.message ?? null;
  const occurrenceCount = new Map<string, number>();
  let occurrencesLoaded = true;
  const steps: { order_id: string; step_key: string; status: string; started_at: string | null; assignee_id: string | null }[] = [];
  for (let index = 0; index < ids.length; index += 150) {
    const { data, error: stepError } = await supabase
      .from("assembly_steps")
      .select("order_id, step_key, status, started_at, assignee_id")
      .in("order_id", ids.slice(index, index + 150));
    if (stepError) boardError = "Não foi possível carregar todas as etapas. Atualize antes de registrar a montagem.";
    steps.push(...((data ?? []) as typeof steps));
    const { data: occurrences, error: occurrenceError } = await supabase.from("quality_occurrences").select("order_id").in("order_id", ids.slice(index, index + 150)).in("status", ["aberta", "em_tratamento"]);
    if (occurrenceError) { occurrencesLoaded = false; boardError = "Não foi possível conferir as ocorrências. Consulte os detalhes antes de liberar uma OS."; }
    for (const occurrence of occurrences ?? []) occurrenceCount.set(occurrence.order_id, (occurrenceCount.get(occurrence.order_id) ?? 0) + 1);
  }
  const assigneeIds = [...new Set(steps.map((step) => step.assignee_id).filter(Boolean))] as string[];
  const { data: people } = assigneeIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", assigneeIds)
    : { data: [] as { id: string; full_name: string }[] };
  const names = new Map((people ?? []).map((person) => [person.id as string, person.full_name as string]));

  const bench: BenchOrder[] = (orders ?? []).map((order) => ({
    ...operations.get(order.id),
    id: order.id as string,
    number: order.number as string,
    clientName: order.client_name as string,
    serviceDescription: (order.service_description as string | null) ?? null,
    laboratoryName: (order.laboratory_name as string | null) ?? null,
    sellerName: (order.seller_name as string | null) ?? null,
    storeName: (order.store_name as string | null) ?? null,
    externalOrderId: (order.external_order_id as string | null) ?? null,
    dueAt: (order.due_at as string | null) ?? null,
    enteredAt: order.entered_at as string,
    status: order.status as BenchOrder["status"],
    urgent: order.priority === "critica",
    openOccurrences: occurrencesLoaded ? occurrenceCount.get(order.id) ?? 0 : null,
    steps: steps
      .filter((step) => step.order_id === order.id)
      .map((step) => ({
        key: step.step_key as BenchOrder["steps"][number]["key"],
        status: step.status as BenchOrder["steps"][number]["status"],
        startedAt: step.started_at,
        assigneeId: step.assignee_id,
        assignee: step.assignee_id ? (names.get(step.assignee_id) ?? null) : null,
      })),
  }));

  const detail = filters.os && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(filters.os) ? await loadOrderDetail(filters.os) : null;
  return <>
    <BenchBoard sellers={catalogs.sellers} orders={bench} role={role} userId={user.id} error={boardError} nowIso={new Date().toISOString()} />
    {detail ? <OrderDrawer key={detail.order.id} title={`OS ${visibleOrderNumber(detail.order)}`} closeHref="/montagem" description="Acompanhe etapas, fotos e ocorrências sem sair da bancada." detailHref={`/montagem/${detail.order.id}`} workspace={<OrderWorkspace {...detail} mode="montagem" />} /> : null}
  </>;
}
