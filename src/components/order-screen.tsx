import { OrderContextMenu, OrderMenuRow } from "./order-context-menu";
import { Fragment } from "react";
import { ArrowUpRight, ChevronDown, ListFilter, PackageCheck, Plus, Search, Zap } from "lucide-react";
import Link from "next/link";
import { OrderKanban } from "@/components/order-kanban";
import { StatusBadge } from "@/components/status-badge";
import { Button, EmptyState, Panel } from "@/components/ui";
import { PageHeading } from "@/components/shell";
import { ORDER_STATUSES, STATUS_LABEL, type AppRole, type OrderStatus } from "@/lib/domain/constants";
import { can } from "@/lib/domain/permissions";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { groupByStoreThenSeller, sellerColor, storeColor } from "@/lib/domain/queue-groups";
import { forecastOrder } from "@/lib/domain/forecast";
import { RiskChip } from "@/components/forecast-ui";
import { dueDeltaLabel } from "@/lib/domain/urgency";
import type { Laboratory, OrderRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ORDER_TABS, ORDER_TAB_LABEL, type OrderTab } from "@/server/queries";

function deadlineTone(order: OrderRow) {
  if (order.status === "entregue" || order.status === "pronto") return "text-[var(--ok)] font-medium";
  if (!order.due_at || order.status === "cancelado") return "text-[var(--muted)]";
  if (new Date(order.due_at).getTime() < Date.now()) return "text-[var(--danger)] font-semibold";
  if (order.urgency === "amarelo") return "text-[var(--warning)] font-semibold";
  return "text-[var(--muted)]";
}

function FilterSelect({ name, defaultValue, children, label }: { name: string; defaultValue?: string; children: React.ReactNode; label: string }) {
  return (
    <label className="relative flex text-[var(--muted)]">
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-11 cursor-pointer appearance-none rounded-lg border border-[var(--line)] bg-[var(--surface)] pl-3 pr-8 text-base text-[var(--ink)] outline-none focus:border-[var(--focus)] md:h-9 md:text-sm"
      >
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-3.5 md:top-2.5" />
    </label>
  );
}

/** Formata só a data dd/mm para a coluna de prazo compacta */
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function OrderScreen({
  title,
  description,
  basePath,
  detailPath,
  orders,
  count,
  page,
  pageSize,
  filters,
  laboratories,
  sellers = [],
  role,
  error,
  statuses,
  tabCounts,
  wipLimits,
}: {
  title: string;
  description: string;
  basePath: string;
  detailPath: string;
  orders: OrderRow[];
  count: number;
  page: number;
  pageSize: number;
  filters: Record<string, string | undefined>;
  laboratories: Laboratory[];
  sellers?: { id: string; name: string }[];
  role: AppRole;
  error: string | null;
  statuses?: OrderStatus[];
  tabCounts?: Record<OrderTab, number>;
  wipLimits?: Record<string, number>;
}) {
  const view = filters.view === "kanban" ? "kanban" : "lista";
  const bySeller = [...orders].sort((a,b)=>(a.seller_name||"Sem vendedora").localeCompare(b.seller_name||"Sem vendedora", "pt-BR") || (a.seller_id||"").localeCompare(b.seller_id||""));
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const query = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { ...filters, ...patch };
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
    }
    const text = params.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  const orderHref = (id: string) => basePath === "/laboratorio" ? query({ os: id }) : `${detailPath}/${id}`;
  const hasFilters = Boolean(filters.q || filters.status || filters.urgency || filters.laboratory || filters.seller);
  const segment = (on: boolean) =>
    cn(
      "flex h-10 items-center rounded-[7px] px-3 text-[13px] font-semibold md:h-7",
      on ? "bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_2px_rgba(19,32,31,0.12)]" : "text-[var(--muted)] hover:text-[var(--ink)]",
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho */}
      <PageHeading title={title} description={description}>
        {basePath === "/laboratorio" && can(role, "orders.deliver") ? (
          <Button variant="secondary" asChild>
            <Link href="/laboratorio/rapido?modo=saida">
              <PackageCheck size={16} />
              Saída rápida
            </Link>
          </Button>
        ) : null}
        {basePath === "/laboratorio" && can(role, "orders.write") ? (
          <Button asChild>
            <Link href="/laboratorio/rapido">
              <Zap size={16} />
              Entrada rápida
            </Link>
          </Button>
        ) : null}
        {basePath === "/laboratorio" && can(role, "orders.write") ? (
          <Button variant="secondary" asChild>
            <Link href="/laboratorio/nova">
              <Plus size={16} />
              OS completa
            </Link>
          </Button>
        ) : null}
      </PageHeading>

      {tabCounts ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo da produção">
        {([
          { tab: "andamento", label: "Na operação", value: tabCounts.andamento, hint: "Acompanhar a fila", color: "var(--accent)" },
          { tab: "atrasadas", label: "Prazo vencido", value: tabCounts.atrasadas, hint: "Priorizar agora", color: "var(--danger)" },
          { tab: "ocorrencia", label: "Com ocorrência", value: tabCounts.ocorrencia, hint: "Conferir impedimentos", color: "var(--warning)" },
          { tab: "prontas", label: "Para retirada", value: tabCounts.prontas, hint: "Conferidas e liberadas", color: "var(--ok)" },
        ] as const).map((item) => <Link key={item.tab} href={query({ tab: item.tab, status: undefined, os: undefined, page: undefined })} className="group rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]">
          <span className="flex items-center justify-between text-xs font-semibold text-[var(--muted)]">{item.label}<ArrowUpRight size={15} /></span>
          <span className="mt-2 block font-mono text-3xl font-medium tabular-nums" style={{ color: item.color }}>{item.value}</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">{item.hint}</span>
        </Link>)}
      </div> : null}

      {/* Busca e filtros */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3" method="get" action={basePath}>
        <ListFilter size={17} className="hidden text-[var(--muted)] md:block" />
        <label className="flex h-11 flex-[1_1_220px] items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[var(--muted)] focus-within:border-[var(--focus)] md:h-9">
          <Search size={16} className="shrink-0" />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="OS, cliente ou vendedor"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--ink)] shadow-none outline-none placeholder:text-[var(--muted)] focus:shadow-none"
          />
        </label>
        <FilterSelect name="status" defaultValue={filters.status} label="Status">
          <option value="">Todos os status</option>
          {(statuses ?? ORDER_STATUSES).map((status) => (
            <option key={status} value={status}>{STATUS_LABEL[status]}</option>
          ))}
        </FilterSelect>
        <FilterSelect name="urgency" defaultValue={filters.urgency} label="Urgência">
          <option value="">Qualquer urgência</option>
          <option value="vermelho">⚠ Atrasado</option>
          <option value="amarelo">⏳ Atenção</option>
          <option value="verde">✓ No prazo</option>
        </FilterSelect>
        <FilterSelect name="seller" defaultValue={filters.seller} label="Vendedora"><option value="">Todas as vendedoras</option>{sellers.map(seller => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</FilterSelect>
        {laboratories.length > 1 ? (
          <FilterSelect name="laboratory" defaultValue={filters.laboratory} label="Laboratório">
            <option value="">Todos os labs</option>
            {laboratories.map((lab) => (
              <option key={lab.id} value={lab.id}>{lab.name}</option>
            ))}
          </FilterSelect>
        ) : null}
        <input type="hidden" name="view" value={view} />
        {filters.tab ? <input type="hidden" name="tab" value={filters.tab} /> : null}
        <Button type="submit" variant="secondary">Filtrar</Button>
        {hasFilters ? (
          <Link href={query({ q: undefined, status: undefined, urgency: undefined, laboratory: undefined, seller: undefined, page: undefined })} className="inline-flex h-11 items-center px-2 text-[13px] font-semibold text-[var(--link)] hover:underline md:h-auto md:px-1.5">
            Limpar
          </Link>
        ) : null}
      </form>

      {/* Abas de situação + toggle lista/kanban */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)]">
        <div className="flex flex-wrap gap-0.5">
          {filters.status ? (
            <p className="mb-2 text-sm font-semibold text-[var(--link)]">
              {count} OS neste status. Outras etapas ficam no Painel.
            </p>
          ) : tabCounts
            ? ORDER_TABS.map((tab) => {
                const on = filters.tab === tab;
                return (
                  <Link
                    key={tab}
                    href={query({ tab, status: undefined, page: undefined })}
                    className={cn(
                      "-mb-px flex h-11 min-w-0 items-center gap-2 border-b-2 px-3 text-sm md:h-10",
                      on ? "border-[var(--focus)] font-semibold text-[var(--ink)]" : "border-transparent font-medium text-[var(--muted)] hover:text-[var(--ink)]",
                    )}
                  >
                    {ORDER_TAB_LABEL[tab]}
                    <span className={cn("rounded-[5px] px-1.5 text-xs font-semibold", on ? "bg-[var(--accent-soft)] text-[var(--link)]" : "bg-[var(--surface-secondary)] text-[var(--muted)]")}>
                      {tabCounts[tab]}
                    </span>
                  </Link>
                );
              })
            : null}
        </div>
        <div className="mb-1.5 flex gap-0.5 rounded-[9px] bg-[var(--surface-secondary)] p-[3px]">
          <Link className={segment(view === "lista")} href={query({ view: "lista", page: "1" })}>Lista</Link>
          <Link className={segment(view === "kanban")} href={query({ view: "kanban", page: undefined })}>Kanban</Link>
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {orders.length === 0 ? (
        <EmptyState
          title="Nenhuma OS encontrada"
          text="Ajuste os filtros ou abra uma nova ordem de serviço."
        />
      ) : view === "kanban" ? (
        <OrderKanban orders={orders} role={role} hrefBase={detailPath} drawerBase={basePath === "/laboratorio" ? query({ os: undefined }) : undefined} wipLimits={wipLimits} />
      ) : (
        <>
        <div className="grid gap-2 md:hidden">
          <p className="px-1 text-[11px] font-semibold text-[var(--muted)]">Atrasada · prazo próximo · no prazo — toque na loja e na vendedora para abrir</p>
          {groupByStoreThenSeller(orders).map((storeGroup) => (
            <details open key={storeGroup.store} className="grid gap-2 rounded-xl">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3.5 py-2.5 text-white" style={{ background: storeColor(storeGroup.store) }}>
                <span className="font-semibold">{storeGroup.store}</span>
                <span className="text-xs">{storeGroup.sellers.reduce((sum, item) => sum + item.orders.length, 0)} OS · {storeGroup.sellers.length} vend.</span>
              </summary>
              {storeGroup.sellers.map((sellerGroup) => (
                <details open key={`${storeGroup.store}-${sellerGroup.seller}`} className="grid gap-2">
                  <summary className="ml-1 inline-flex w-fit cursor-pointer list-none items-center rounded-full border px-2.5 py-1 text-xs font-bold" style={{ color: sellerColor(sellerGroup.seller), borderColor: sellerColor(sellerGroup.seller), background: `${sellerColor(sellerGroup.seller)}22` }}>
                    {sellerGroup.seller} · {sellerGroup.orders.length} OS
                  </summary>
                  {sellerGroup.orders.map((order) => {
                    const deltaLabel = dueDeltaLabel(order.due_at, new Date(), order.status);
                    const late = order.urgency === "vermelho" || (order.due_at && new Date(order.due_at).getTime() < Date.now());
                    const soon = order.urgency === "amarelo";
                    return (
                      <OrderContextMenu key={order.id} role={role} order={{ id: order.id, number: visibleOrderNumber(order), status: order.status, clientName: order.client_name, detailsHref: orderHref(order.id) }}>
                      <Link
                        href={orderHref(order.id)} scroll={false}
                        className="lg-os-row"
                      >
                        <span className="lg-os-avatar" data-tone={late ? "late" : soon ? "soon" : "ok"} aria-hidden>{order.client_name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</span>
                        <span className="lg-os-row-body">
                          <span className="flex items-baseline gap-2">
                            <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold leading-snug">{order.client_name}</span>
                            <span className={cn("shrink-0 text-xs font-semibold", deadlineTone(order))}>{deltaLabel}</span>
                          </span>
                          <span className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                            <span className="min-w-0 flex-1 truncate"><span className="font-mono text-xs">{visibleOrderNumber(order)}</span> · {order.laboratory_name || "Sem laboratório"}</span>
                            <StatusBadge status={order.status} />
                          </span>
                        </span>
                      </Link>
                      </OrderContextMenu>
                    );
                  })}
                </details>
              ))}
            </details>
          ))}
          <div className="flex items-center justify-between px-1 py-2 text-[13px] text-[var(--muted)]">
            <span>{count} OS</span>
            <div className="flex items-center gap-3">
              {page > 1 ? <Link className="inline-flex h-11 items-center font-medium text-[var(--link)]" href={query({ page: String(page - 1) })}>← Anterior</Link> : <span className="text-[var(--fg-b4bec2)]">← Anterior</span>}
              <span className="font-mono">{page} / {pages}</span>
              {page < pages ? <Link className="inline-flex h-11 items-center font-medium text-[var(--link)]" href={query({ page: String(page + 1) })}>Próxima →</Link> : <span className="text-[var(--fg-b4bec2)]">Próxima →</span>}
            </div>
          </div>
        </div>
        <Panel className="hidden overflow-x-auto md:block">
          {/* Tabela compacta: apenas o essencial */}
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[var(--background)]">
                {["Ordem de serviço", "Cliente · responsável", "Prazo prometido", "Situação", ""].map((head, index) => (
                  <th
                    key={head}
                    className={cn(
                      "border-b border-[var(--line)] py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]",
                      index === 0 ? "pl-4 pr-3 w-[110px]" : index === 3 ? "pl-3 pr-4 w-[160px]" : index === 2 ? "px-3 w-[90px]" : "px-3",
                    )}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bySeller.map((order,index) => {
                const deltaLabel = dueDeltaLabel(order.due_at, new Date(), order.status);
                const forecast = forecastOrder({ status: order.status, dueAt: order.due_at, stepsDone: order.steps_done, lensExpectedAt: order.lens_expected_at });
                return (
                  <Fragment key={order.id}>{(index===0 || bySeller[index-1].seller_id!==order.seller_id) && <tr><th colSpan={5} scope="rowgroup" className="bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--link)]">{order.seller_name || "Sem vendedora"} · {bySeller.filter(item=>item.seller_id===order.seller_id).length} OS nesta página</th></tr>}<OrderMenuRow role={role} order={{ id: order.id, number: visibleOrderNumber(order), status: order.status, clientName: order.client_name, detailsHref: orderHref(order.id) }} className="group border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--background)]">
                    {/* OS + Lab */}
                    <td className="py-2.5 pl-4 pr-3">
                      <Link href={orderHref(order.id)} scroll={false} className="flex flex-col gap-0.5">
                        <span className="font-mono text-[13px] font-semibold text-[var(--link)] group-hover:underline">{visibleOrderNumber(order)}</span>
                        <span className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
                          <span className="h-[6px] w-[6px] shrink-0 rounded-[2px]" style={{ background: order.laboratory_color }} />
                          {order.laboratory_name}
                        </span>
                      </Link>
                    </td>
                    {/* Cliente + Vendedor */}
                    <td className="px-3 py-2.5">
                      <Link href={orderHref(order.id)} scroll={false} className="flex flex-col gap-0.5">
                        <span className="font-semibold leading-tight">{order.client_name}</span>
                        <span className="text-xs text-[var(--muted)]">{order.seller_name || order.store_name || "—"}</span>
                      </Link>
                    </td>
                    {/* Prazo */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="tabular-nums text-[13px]">{fmtDate(order.due_at)}</span>
                        {deltaLabel ? (
                          <span className={cn("text-[11px]", deadlineTone(order))}>{deltaLabel}</span>
                        ) : null}
                        <RiskChip risk={forecast.risk} />
                      </div>
                    </td>
                    {/* Status */}
                    <td className="py-2.5 pl-3 pr-4">
                      <StatusBadge status={order.status} />
                      <p className="mt-2 text-xs text-[var(--muted)]">{order.steps_done ?? 0} etapas opcionais registradas</p>
                    </td>
                    <td className="pr-4"><Link href={orderHref(order.id)} scroll={false} aria-label={`Abrir OS ${visibleOrderNumber(order)}`} className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--line)] text-[var(--link)] hover:bg-[var(--accent-soft)]"><ArrowUpRight size={17} /></Link></td>
                  </OrderMenuRow></Fragment>
                );
              })}
            </tbody>
          </table>
          {/* Paginação */}
          <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5 text-[13px] text-[var(--muted)]">
            <span>{count} OS</span>
            <div className="flex items-center gap-3">
              {page > 1 ? <Link className="font-medium text-[var(--link)] hover:underline" href={query({ page: String(page - 1) })}>← Anterior</Link> : <span className="text-[var(--fg-b4bec2)]">← Anterior</span>}
              <span className="font-mono">{page} / {pages}</span>
              {page < pages ? <Link className="font-medium text-[var(--link)] hover:underline" href={query({ page: String(page + 1) })}>Próxima →</Link> : <span className="text-[var(--fg-b4bec2)]">Próxima →</span>}
            </div>
          </div>
        </Panel>
        </>
      )}
    </div>
  );
}
