"use client";

import { awaitingDoctor, OrderActionsButton, StageArrows, useOrderMenu } from "./order-context-menu";
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { KANBAN_AUTO_SCROLL, KanbanViewport } from "./kanban-viewport";
import { ChevronDown, ChevronRight, Clock, Gauge, GripVertical, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { wipState } from "@/lib/domain/lean";
import { QUEUE_STATUSES, STATUS_LABEL, type AppRole, type OrderStatus } from "@/lib/domain/constants";
import { allowedTargets, canTransition } from "@/lib/domain/status";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { dueDeltaLabel } from "@/lib/domain/urgency";
import type { OrderRow } from "@/lib/types";
import { changeOrderStatus } from "@/server/actions";
import { RISK_LABEL, RISK_TONE } from "@/lib/domain/forecast";
import { orderForecast, selectBoardOrders, type BoardFocus, type BoardSort } from "@/lib/domain/kanban";
import { stageStyle, StepTrack } from "./production-visuals";
import { LensGauge } from "./lens";
import { Feedback } from "./ui";

function deadlineStyle(order: OrderRow) {
  if (!order.due_at || order.status === "pronto") return { color: "var(--muted)", fontWeight: 400 };
  if (new Date(order.due_at).getTime() < Date.now()) return { color: "var(--danger)", fontWeight: 600 };
  if (order.urgency === "amarelo") return { color: "var(--warning)", fontWeight: 600 };
  return { color: "var(--muted)", fontWeight: 400 };
}

function Card({ order, href, role, pending, onMove, now }: { order: OrderRow; href: string; role: AppRole; pending: boolean; onMove: (order: OrderRow, status: OrderStatus) => void; now: Date }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id, disabled: pending || allowedTargets(order.status, role).length === 0 });
  const forecast = orderForecast(order, now);
  const riskTone = RISK_TONE[forecast.risk];
  const targets = allowedTargets(order.status, role).filter((status) => QUEUE_STATUSES.includes(status));
  const menuOrder = { id: order.id, number: visibleOrderNumber(order), status: order.status, clientName: order.client_name, detailsHref: href, medicalRequired: order.medical_review_required, medicalApproved: order.medical_review_approved_at, updatedAt: order.updated_at };
  const quick = useOrderMenu(menuOrder, role);
  return (
    <article
      ref={setNodeRef}
      onContextMenu={quick.handlers.onContextMenu}
      style={stageStyle(order.status)}
      data-kanban-card
      data-urgency={forecast.risk === "atrasada" ? "late" : order.priority === "critica" ? "critical" : "normal"}
      className={`lg-card flex flex-col gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 pb-2.5 pt-3 shadow-[0_1px_2px_rgba(19,32,31,0.04)] transition-shadow hover:border-[var(--line)] hover:shadow-[0_4px_12px_-6px_rgba(19,32,31,0.18)] ${isDragging ? "opacity-30" : ""}`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-medium text-[var(--link)]">{visibleOrderNumber(order)}</span>
          <div className="flex items-center gap-1">
            <span className="rounded px-1.5 py-1 text-[11px] font-semibold" style={{ color: riskTone.fg, background: riskTone.bg }} title={forecast.reason}>{RISK_LABEL[forecast.risk]}</span>
            {targets.length > 0 ? <button type="button" aria-label={`Arrastar OS ${visibleOrderNumber(order)}`} className="flex h-11 w-9 cursor-grab items-center justify-center rounded text-[var(--muted)] touch-none active:cursor-grabbing" {...listeners} {...attributes}><GripVertical size={16} /></button> : null}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="break-words text-sm font-semibold">{order.client_name}</span>
            <span className="break-words text-xs text-[var(--muted)]">
              {order.laboratory_name || "Sem laboratório"} · {order.seller_name || "Sem vendedor"}
              {order.store_name ? ` · ${order.store_name}` : ""}
            </span>
          </div>
          <LensGauge value={forecast.progress} risk={forecast.risk} size={46} />
        </div>
        {order.status === "aguardando_lentes" ? (
          <div className="rounded-md bg-[var(--warning-soft)] px-2 py-[5px] text-xs font-medium text-[var(--warning)]">Aguardando lentes, montagem não iniciada</div>
        ) : null}
        {order.priority === "critica" ? <span className="text-xs font-semibold text-[var(--danger)]">Prioridade crítica</span> : null}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
          <span>Etapas opcionais registradas: {order.steps_done ?? 0}</span>
          {order.lens_arrived_at ? <span>Lentes recebidas</span> : order.status === "aguardando_lentes" ? <span>{order.lens_expected_at ? `Chegada: ${new Date(order.lens_expected_at).toLocaleDateString("pt-BR")}` : "Lentes sem previsão"}</span> : null}
          {order.lens_supplier_ref ? <span>Pedido: {order.lens_supplier_ref}</span> : null}
        </div>
        {forecast.risk === "risco" ? (
          <div className="rounded-md bg-[var(--danger-soft)] px-2 py-[5px] text-xs font-semibold text-[var(--danger)]" title={forecast.reason}>
            Risco de atraso · priorizar
          </div>
        ) : null}
      </div>
      <StepTrack done={order.steps_done ?? 0}/>
      <StageArrows waitingDoctor={awaitingDoctor({ status: order.status, medicalRequired: order.medical_review_required, medicalApproved: order.medical_review_approved_at })} status={order.status} role={role} orderId={order.id} number={visibleOrderNumber(order)} disabled={pending} onMove={(to) => onMove(order, to as OrderStatus)} />
      <div className="flex items-center justify-between border-t border-[var(--line)] pt-2 text-xs">
        <span className="flex items-center gap-[5px]" style={deadlineStyle(order)}>
          <Clock size={13} />
          {order.status === "pronto" ? "Disponível para retirada" : dueDeltaLabel(order.due_at, now, order.status)}
        </span>
<span className="flex items-center gap-1">
          <OrderActionsButton role={role} order={menuOrder} />
          <Link href={href} className="inline-flex min-h-11 items-center px-1 font-semibold text-[var(--link)] hover:underline md:min-h-0" onPointerDown={(event) => event.stopPropagation()}>
            Abrir
          </Link>
        </span>
      </div>
      {quick.element}
    </article>
  );
}

function Column({ status, orders, hrefBase, drawerBase, limit, total, collapsed, onToggle, role, pending, onMove, now }: { status: OrderStatus; orders: OrderRow[]; hrefBase: string; drawerBase?: string; limit?: number; total: number; collapsed: boolean; onToggle: () => void; role: AppRole; pending: boolean; onMove: (order: OrderRow, status: OrderStatus) => void; now: Date }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const wip = wipState(total, limit);
  const tone =
    wip === "estourado"
      ? "bg-[var(--bg-fbe4e1)] ring-2 ring-[var(--danger)]/50"
      : wip === "no_limite"
        ? "bg-[var(--bg-fbf1dc)]"
        : "bg-[var(--surface-secondary)]";
  return (
    <div
      ref={setNodeRef}
      data-kanban-column={status}
      data-collapsed={collapsed||undefined}
      style={stageStyle(status)}
      className={`kanban-column lg-lane ${tone} ${isOver ? "ring-2 ring-[var(--focus)]" : ""}`}
    >
      {collapsed ? <h2 className="kanban-column-heading"><button type="button" onClick={onToggle} aria-expanded={false} aria-label={`Expandir coluna ${STATUS_LABEL[status]}`} className="kanban-column-strip"><ChevronRight size={16}/><span>{STATUS_LABEL[status]}</span><span>{orders.length}</span></button></h2> : <>
      <div className="kanban-column-heading flex items-center gap-2 px-1 pb-1.5 pt-1">
        <span className="h-2 w-2 rounded-[2px]" style={{ background: "var(--lane)" }} />
        <h2 className="flex-1 text-[13px] font-semibold"><button type="button" onClick={onToggle} aria-label={`Recolher coluna ${STATUS_LABEL[status]}`} aria-expanded={!collapsed} className="flex min-h-11 w-full items-center gap-1 text-left">{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{STATUS_LABEL[status]}</button></h2>
        {limit ? (
          <span
            title="Limite WIP (trabalho em processo) desta coluna"
            className={`flex items-center gap-1 rounded-md px-1.5 py-px font-mono text-xs font-semibold ${
              wip === "estourado" ? "bg-[var(--danger-solid)] text-white" : wip === "no_limite" ? "bg-[var(--bg-87601f)] text-white" : "bg-[var(--surface)] text-[var(--muted)]"
            }`}
          >
            <Gauge size={12} />
            {total}/{limit}
          </span>
        ) : (
          <span className="font-mono text-xs text-[var(--muted)]">{orders.length}</span>
        )}
      </div>
      {limit ? <div className="lg-bar" role="img" aria-label={`${total} OS de um limite de ${limit}`}><span style={{width:`${Math.min(100,total/limit*100)}%`,background:total>=limit?"var(--danger)":undefined}}/></div> : null}
      {wip === "estourado" ? (
        <div className="rounded-md bg-[var(--danger-solid)] px-2 py-1 text-[11px] font-semibold text-white">Acima do limite WIP: termine antes de puxar mais</div>
      ) : null}
      <div className="kanban-column-body" data-kanban-column-body tabIndex={0} role="region" aria-label={`Serviços em ${STATUS_LABEL[status]}`}>
      {!collapsed && orders.map((order) => (
        <Card key={order.id} order={order} role={role} pending={pending} onMove={onMove} now={now} href={drawerBase ? `${drawerBase}${drawerBase.includes("?") ? "&" : "?"}os=${order.id}` : `${hrefBase}/${order.id}`} />
      ))}
      {!collapsed && orders.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[var(--line)] px-3 py-[18px] text-center text-xs text-[var(--muted)]">Nenhuma OS</div>
      ) : null}
      </div>
      </>}
    </div>
  );
}

export function OrderKanban({
  orders,
  role,
  hrefBase,
  drawerBase,
  wipLimits,
}: {
  orders: OrderRow[];
  role: AppRole;
  hrefBase: string;
  drawerBase?: string;
  wipLimits?: Record<string, number>;
}) {
  const router = useRouter();
  const boardId = useId();
  const [draggingId,setDraggingId]=useState<string|null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startMove] = useTransition();
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<BoardFocus>("all");
  const [sellerId, setSellerId] = useState("");
  const [sort, setSort] = useState<BoardSort>("risk");
  const [collapsed, setCollapsed] = useState<OrderStatus[]>([]);
  const now = new Date();
  // Movimento otimista: o cartão muda de coluna na hora; o servidor confirma em segundo plano.
  const [board, moveCard] = useOptimistic(orders, (state, move: { id: string; status: OrderStatus }) =>
    state.map((order) => (order.id === move.id ? { ...order, status: move.status } : order)),
  );
  const sensors = useSensors(
    useSensor(KeyboardSensor),
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const loaded = board.filter((order) => QUEUE_STATUSES.includes(order.status));
  const visible = selectBoardOrders(loaded, { query, focus, sellerId, sort }, now);
  const sellers = Array.from(new Map(orders.filter((order) => order.seller_id).map((order) => [order.seller_id!, order.seller_name || "Sem nome"])).entries()).sort((a, b) => a[1].localeCompare(b[1]));

  const draggingOrder=board.find(order=>order.id===draggingId);

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const order = board.find((item) => item.id === event.active.id);
    const status = event.over?.id as OrderStatus | undefined;
    if (order && status) moveOrder(order, status);
  }

  function moveOrder(order: OrderRow, status: OrderStatus) {
    if (pending || order.status === status) return;
    if (!canTransition(order.status, status, role)) {
      setError("Esta mudança de status não faz parte do fluxo ou do seu perfil.");
      return;
    }
    const limit = wipLimits?.[status];
    const target = board.filter((item) => item.status === status).length;
    if (limit && target >= limit) toast.warning(`${STATUS_LABEL[status]} passou do limite WIP (${target + 1}/${limit}).`);
    setError(null);
    startMove(async () => {
      moveCard({ id: order.id, status });
      try {
        const result = await changeOrderStatus(order.id, status, "Movimentação pelo quadro");
        if (!result.ok) setError(result.message);
        else toast.success(`OS ${visibleOrderNumber(order)}: ${STATUS_LABEL[status]}`);
      } catch {
        setError("Não foi possível confirmar a movimentação. Confira a conexão e tente novamente.");
      } finally {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <label className="min-w-48 flex-1 text-xs font-medium text-[var(--muted)]">Buscar no quadro
          <div className="mt-1 flex items-center gap-2 rounded-md border border-[var(--line)] px-3"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="OS, cliente, vendedor ou pedido" className="min-h-11 w-full min-w-0 bg-transparent text-sm outline-none" /></div>
        </label>
        <label className="text-xs font-medium text-[var(--muted)]">Vendedor<select value={sellerId} onChange={(event) => setSellerId(event.target.value)} className="mt-1 block min-h-11 max-w-48 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"><option value="">Todos os vendedores</option>{sellers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="text-xs font-medium text-[var(--muted)]">Ordenação<select value={sort} onChange={(event) => setSort(event.target.value as BoardSort)} className="mt-1 block min-h-11 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"><option value="risk">Maior risco primeiro</option><option value="deadline">Prazo mais próximo</option><option value="oldest">Entrada mais antiga</option></select></label>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Foco do quadro">
        {([["all", "Todas"], ["risk", "Atenção aos prazos"], ["critical", "Prioridade crítica"], ["missing_eta", "Lentes sem previsão"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={focus === value} onClick={() => setFocus(value)} className={`min-h-11 rounded-lg border px-3 text-xs font-semibold ${focus === value ? "border-[var(--focus)] bg-[var(--accent-soft)] text-[var(--link)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"}`}>{label}</button>)}
        <span className="ml-auto text-xs text-[var(--muted)]" role="status">{visible.length} de {loaded.length} OS carregadas{pending ? " · Salvando…" : ""}</span>
        {query || sellerId || focus !== "all" ? <button type="button" onClick={() => { setQuery(""); setSellerId(""); setFocus("all"); }} className="min-h-11 px-2 text-xs font-semibold text-[var(--link)]">Limpar filtros</button> : null}
      </div>
      <p className="text-xs text-[var(--muted)]">Use a alça para arrastar, ou os botões Voltar / Avançar e Ações no cartão. Filtros e ordenação se aplicam às OS carregadas; a capacidade considera todo o quadro carregado.</p>
      <Feedback error={error} />
      <DndContext id={boardId} sensors={sensors} autoScroll={KANBAN_AUTO_SCROLL} onDragStart={event=>setDraggingId(String(event.active.id))} onDragCancel={()=>setDraggingId(null)} onDragEnd={onDragEnd}>
        <KanbanViewport label="Kanban de produção" dragging={Boolean(draggingId)} lanes={QUEUE_STATUSES.map(status=>({id:status,label:STATUS_LABEL[status],count:visible.filter(order=>order.status===status).length}))}>
          {QUEUE_STATUSES.map((status) => (
            <Column key={status} status={status} hrefBase={hrefBase} drawerBase={drawerBase} limit={wipLimits?.[status]} total={board.filter((order) => order.status === status).length} orders={visible.filter((order) => order.status === status)} collapsed={collapsed.includes(status)} onToggle={() => setCollapsed((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status])} role={role} pending={pending} onMove={moveOrder} now={now} />
          ))}
        </KanbanViewport>
        <DragOverlay>{draggingOrder?<article className="w-[280px] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-lg"><p className="font-mono text-xs text-[var(--link)]">OS {visibleOrderNumber(draggingOrder)}</p><p className="mt-2 text-sm font-semibold">{draggingOrder.client_name}</p><p className="mt-2 text-xs text-[var(--muted)]">{STATUS_LABEL[draggingOrder.status]}</p></article>:null}</DragOverlay>
      </DndContext>
    </div>
  );
}
