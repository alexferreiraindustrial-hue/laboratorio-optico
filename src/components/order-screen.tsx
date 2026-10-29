import { ChevronDown, PackageCheck, Plus, Search, Zap } from "lucide-react";
import Link from "next/link";
import { OrderKanban } from "@/components/order-kanban";
import { StatusBadge, UrgencyMark } from "@/components/status-badge";
import { Button, EmptyState, Panel } from "@/components/ui";
import { PageHeading } from "@/components/shell";
import { ORDER_STATUSES, STATUS_LABEL, type AppRole, type OrderStatus } from "@/lib/domain/constants";
import { can } from "@/lib/domain/permissions";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { dueDeltaLabel } from "@/lib/domain/urgency";
import type { Laboratory, OrderRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ORDER_TABS, ORDER_TAB_LABEL, type OrderTab } from "@/server/queries";

function deadlineTone(order: OrderRow) {
  if (order.status === "entregue" || order.status === "pronto") return "text-[#1c6b43] font-medium";
  if (!order.due_at || order.status === "cancelado") return "text-[#8a9694]";
  if (new Date(order.due_at).getTime() < Date.now()) return "text-[#b42318] font-semibold";
  if (order.urgency === "amarelo") return "text-[#8a5a00] font-semibold";
  return "text-[#6e7c7a]";
}

function FilterSelect({ name, defaultValue, children, label }: { name: string; defaultValue?: string; children: React.ReactNode; label: string }) {
  return (
    <label className="relative flex text-[#6e7c7a]">
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-9 cursor-pointer appearance-none rounded-lg border border-[#cdd5d8] bg-white pl-3 pr-8 text-sm text-[#13201f] outline-none focus:border-[#0e6b62]"
      >
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-2.5" />
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
  role: AppRole;
  error: string | null;
  statuses?: OrderStatus[];
  tabCounts?: Record<OrderTab, number>;
  wipLimits?: Record<string, number>;
}) {
  const view = filters.view === "kanban" ? "kanban" : "lista";
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
  const hasFilters = Boolean(filters.q || filters.status || filters.urgency || filters.laboratory);
  const segment = (on: boolean) =>
    cn(
      "flex h-7 items-center rounded-[7px] px-3 text-[13px] font-semibold",
      on ? "bg-white text-[#13201f] shadow-[0_1px_2px_rgba(19,32,31,0.12)]" : "text-[#6e7c7a] hover:text-[#13201f]",
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
          <Button variant="secondary" asChild>
            <Link href="/laboratorio/rapido">
              <Zap size={16} />
              Lançar
            </Link>
          </Button>
        ) : null}
        {basePath === "/laboratorio" && can(role, "orders.write") ? (
          <Button asChild>
            <Link href="/laboratorio/nova">
              <Plus size={16} />
              Nova OS
            </Link>
          </Button>
        ) : null}
      </PageHeading>

      {/* Busca e filtros */}
      <form className="flex flex-wrap items-center gap-2" method="get">
        <label className="flex h-9 flex-[1_1_220px] items-center gap-2 rounded-lg border border-[#cdd5d8] bg-white px-2.5 text-[#6e7c7a] focus-within:border-[#0e6b62]">
          <Search size={16} className="shrink-0" />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="OS, cliente ou vendedor"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#13201f] shadow-none outline-none placeholder:text-[#8a9694] focus:shadow-none"
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
          <Link href={query({ q: undefined, status: undefined, urgency: undefined, laboratory: undefined, page: undefined })} className="px-1.5 text-[13px] font-semibold text-[#0e6b62] hover:underline">
            Limpar
          </Link>
        ) : null}
      </form>

      {/* Abas de situação + toggle lista/kanban */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e2e7e9]">
        <div className="flex flex-wrap gap-0.5">
          {tabCounts
            ? ORDER_TABS.map((tab) => {
                const on = !filters.status && filters.tab === tab;
                return (
                  <Link
                    key={tab}
                    href={query({ tab, status: undefined, page: undefined })}
                    className={cn(
                      "-mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-sm",
                      on ? "border-[#0e6b62] font-semibold text-[#13201f]" : "border-transparent font-medium text-[#6e7c7a] hover:text-[#13201f]",
                    )}
                  >
                    {ORDER_TAB_LABEL[tab]}
                    <span className={cn("rounded-[5px] px-1.5 text-xs font-semibold", on ? "bg-[#e4f1ef] text-[#0a4f48]" : "bg-[#eef1f3] text-[#6e7c7a]")}>
                      {tabCounts[tab]}
                    </span>
                  </Link>
                );
              })
            : null}
        </div>
        <div className="mb-1.5 flex gap-0.5 rounded-[9px] bg-[#e7ebed] p-[3px]">
          <Link className={segment(view === "lista")} href={query({ view: "lista", page: "1" })}>Lista</Link>
          <Link className={segment(view === "kanban")} href={query({ view: "kanban", page: undefined })}>Kanban</Link>
        </div>
      </div>

      {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}

      {orders.length === 0 ? (
        <EmptyState
          title="Nenhuma OS encontrada"
          text="Ajuste os filtros ou abra uma nova ordem de serviço."
        />
      ) : view === "kanban" ? (
        <OrderKanban orders={orders} role={role} hrefBase={detailPath} wipLimits={wipLimits} />
      ) : (
        <Panel className="overflow-x-auto">
          {/* Tabela compacta: apenas o essencial */}
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#f7f9f9]">
                {["OS", "Cliente · Vendedor", "Prazo", "Status"].map((head, index) => (
                  <th
                    key={head}
                    className={cn(
                      "border-b border-[#e2e7e9] py-2.5 text-xs font-semibold text-[#6e7c7a]",
                      index === 0 ? "pl-4 pr-3 w-[110px]" : index === 3 ? "pl-3 pr-4 w-[160px]" : index === 2 ? "px-3 w-[90px]" : "px-3",
                    )}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const deltaLabel = dueDeltaLabel(order.due_at, new Date(), order.status);
                return (
                  <tr key={order.id} className="group border-b border-[#eef1f3] last:border-b-0 hover:bg-[#f7f9f9]">
                    {/* OS + Lab */}
                    <td className="py-2.5 pl-4 pr-3">
                      <Link href={`${detailPath}/${order.id}`} className="flex flex-col gap-0.5">
                        <span className="font-mono text-[13px] font-semibold text-[#0e6b62] group-hover:underline">{visibleOrderNumber(order)}</span>
                        <span className="flex items-center gap-1 text-[11px] text-[#6e7c7a]">
                          <span className="h-[6px] w-[6px] shrink-0 rounded-[2px]" style={{ background: order.laboratory_color }} />
                          {order.laboratory_name}
                        </span>
                      </Link>
                    </td>
                    {/* Cliente + Vendedor */}
                    <td className="px-3 py-2.5">
                      <Link href={`${detailPath}/${order.id}`} className="flex flex-col gap-0.5">
                        <span className="font-semibold leading-tight">{order.client_name}</span>
                        <span className="text-xs text-[#6e7c7a]">{order.seller_name || order.store_name || "—"}</span>
                      </Link>
                    </td>
                    {/* Prazo */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="tabular-nums text-[13px]">{fmtDate(order.due_at)}</span>
                        {deltaLabel ? (
                          <span className={cn("text-[11px]", deadlineTone(order))}>{deltaLabel}</span>
                        ) : null}
                        {(order.urgency === "vermelho" || order.urgency === "amarelo") ? (
                          <UrgencyMark urgency={order.urgency} />
                        ) : null}
                      </div>
                    </td>
                    {/* Status */}
                    <td className="py-2.5 pl-3 pr-4">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Paginação */}
          <div className="flex items-center justify-between border-t border-[#eef1f3] px-4 py-2.5 text-[13px] text-[#6e7c7a]">
            <span>{count} OS</span>
            <div className="flex items-center gap-3">
              {page > 1 ? <Link className="font-medium text-[#0e6b62] hover:underline" href={query({ page: String(page - 1) })}>← Anterior</Link> : <span className="text-[#b4bec2]">← Anterior</span>}
              <span className="font-mono">{page} / {pages}</span>
              {page < pages ? <Link className="font-medium text-[#0e6b62] hover:underline" href={query({ page: String(page + 1) })}>Próxima →</Link> : <span className="text-[#b4bec2]">Próxima →</span>}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
