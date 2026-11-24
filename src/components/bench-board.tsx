"use client";
// Kanban da bancada no padrão do Kanban do CRM Industrial: barra de ferramentas (Kanban/Lista, busca,
// Filtros, Colunas, Compacto), colunas com barra de cor, contador, menu, largura ajustável e cartões
// com número, prioridade, tempo na etapa, progresso das etapas e menu de ações.
// Só muda a tela: lê os mesmos dados e usa as mesmas ações do servidor (changeOrderStatus e advanceStep).
import { KANBAN_AUTO_SCROLL, KanbanViewport, type KanbanViewportHandle } from "./kanban-viewport";
import { sellerFilterNames } from "@/lib/domain/seller-filters";
import { stageStyle } from "./production-visuals";
import { LensGauge } from "./lens";
import { ExpressCountdown } from "./order-operations";
import { QuickOrderPhoto } from "./quick-order-photo";
import { can } from "@/lib/domain/permissions";
import {
  ArrowDownUp, Check, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Clock3, Columns3, EyeOff,
  ExternalLink, GripVertical, Rows3, Search, Kanban, LayoutList, MoreHorizontal, Play, ScanLine, SlidersHorizontal, Wrench, X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition, type CSSProperties, type ReactNode } from "react";
import { useOperationMode } from "./operation-mode";
import { RiskChip } from "@/components/forecast-ui";
import { Feedback } from "@/components/ui";
import {
  DndContext, DragOverlay, KeyboardSensor, closestCenter, pointerWithin, MouseSensor, TouchSensor,
  useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import {
  BENCH_LANES, benchDeadlineSignal, benchForecast, nextBenchAction, selectBenchOrders,
  type BenchOrder, type BenchFocus, type BenchSort,
} from "@/lib/domain/bench";
export type { BenchOrder } from "@/lib/domain/bench";
import { STEP_KEYS, STEP_LABEL, STEP_STATUS_LABEL, STATUS_LABEL, type AppRole, type StepKey } from "@/lib/domain/constants";
import { formatHoursShort } from "@/lib/domain/forecast";
import { dueDeltaLabel } from "@/lib/domain/urgency";
import { formatDateTime } from "@/lib/format";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { allowedTargets, canTransition } from "@/lib/domain/status";
import { cn } from "@/lib/utils";
import { advanceStep, changeOrderStatus } from "@/server/actions";

type LaneStatus = BenchOrder["status"];
type BenchView = "coluna" | "kanban";
type Prefs = { view?: BenchView; hidden: LaneStatus[]; collapsed: LaneStatus[]; widths: Partial<Record<LaneStatus, number>>; laneSort: Partial<Record<LaneStatus, BenchSort>> };

const PREFS_KEY = "lab.bancada.kanban.v1";
const EMPTY_PREFS: Prefs = { hidden: [], collapsed: [], widths: {}, laneSort: {} };
const MIN_WIDTH = 248;
const MAX_WIDTH = 480;
const SORT_LABEL: Record<BenchSort, string> = { risk: "Maior risco primeiro", deadline: "Prazo mais próximo", oldest: "Entrada mais antiga" };
const SHORT: Record<StepKey, string> = { conferencia_inicial: "Conferência", lensometria: "Lensometria", blocagem: "Blocagem", facetadora: "Facetadora", conferencia_qualidade: "Qualidade" };

/** Preferências do quadro ficam só neste navegador; nada é gravado no banco. */
let memoryPrefs: string | null = null;
const PREFS_EVENT = "lab-bancada-prefs";
function readRawPrefs(): string | null {
  try { return window.localStorage.getItem(PREFS_KEY) ?? memoryPrefs; } catch { return memoryPrefs; }
}
function writeRawPrefs(value: string) {
  memoryPrefs = value;
  try { window.localStorage.setItem(PREFS_KEY, value); } catch { /* navegador sem armazenamento: vale só nesta aba */ }
  window.dispatchEvent(new Event(PREFS_EVENT));
}
function subscribePrefs(callback: () => void) {
  window.addEventListener(PREFS_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(PREFS_EVENT, callback); window.removeEventListener("storage", callback); };
}
function parsePrefs(raw: string | null): Prefs {
  if (!raw) return EMPTY_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const valid = (list: unknown) => (Array.isArray(list) ? list.filter((item): item is LaneStatus => BENCH_LANES.some((lane) => lane.status === item)) : []);
    return { view: parsed.view === "kanban" ? "kanban" : "coluna", hidden: valid(parsed.hidden), collapsed: valid(parsed.collapsed), widths: parsed.widths ?? {}, laneSort: parsed.laneSort ?? {} };
  } catch {
    return EMPTY_PREFS;
  }
}

function timeOf(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

/** "15 min", "3 h", "2 d" desde que a OS entrou na coluna atual. */
function stageAge(since: string | null | undefined, now: Date) {
  if (!since) return null;
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(since)) / 60000));
  if (!Number.isFinite(minutes)) return null;
  const label = minutes < 60 ? `${minutes} min` : minutes < 48 * 60 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 1440)} d`;
  const tone = minutes >= 48 * 60 ? "late" : minutes >= 24 * 60 ? "warn" : "ok";
  return { label, tone, title: `Nesta coluna desde ${formatDateTime(since)}` };
}

function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Menu suspenso (posição fixa para não ser cortado pela rolagem da coluna; fecha ao clicar fora, rolar ou Esc). */
function Menu({ label, icon, children, align = "right", className }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; className?: string }) {
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const open = pos !== null;
  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const outside = (event: PointerEvent) => { const target = event.target as Node; if (!box.current?.contains(target) && !panel.current?.contains(target)) close(); };
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const scrolled = (event: Event) => { if (!panel.current?.contains(event.target as Node)) close(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", scrolled, true);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); window.removeEventListener("scroll", scrolled, true); window.removeEventListener("resize", close); };
  }, [open]);
  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    if (open) { setPos(null); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const top = Math.min(rect.bottom + 4, window.innerHeight - 120);
    setPos(align === "left" || rect.right < 260 ? { top, left: Math.max(8, rect.left) } : { top, right: Math.max(8, window.innerWidth - rect.right) });
  }
  return (
    <div ref={box} className={cn("bk-menu-wrap", className)} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
      <button type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={toggle} className="bk-icon-btn">{icon}</button>
      {pos ? <div ref={panel} role="menu" className="bk-menu" style={{ position: "fixed", top: pos.top, left: pos.left, right: pos.right, maxHeight: `calc(100vh - ${pos.top + 12}px)` }}>{children(() => setPos(null))}</div> : null}
    </div>
  );
}

function MenuItem({ icon, children, onClick, active, disabled }: { icon?: ReactNode; children: ReactNode; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return <button type="button" role="menuitem" disabled={disabled} onClick={onClick} className={cn("bk-menu-item", active && "is-on")}>{icon ?? <span className="w-4" />}<span className="flex-1 text-left">{children}</span>{active ? <Check size={14} /> : null}</button>;
}

export function BenchBoard({ sellers = [], orders, role, error, nowIso, userId = "" }: { sellers?: { name: string; active: boolean }[]; orders: BenchOrder[]; role: AppRole; error: string | null; nowIso: string; userId?: string }) {
  const router = useRouter();
  const { simple } = useOperationMode();
  const boardId = useId();
  const viewportRef = useRef<KanbanViewportHandle>(null);
  const [query, setQuery] = useState("");
  const [seller, setSeller] = useState("");
  const [focus, setFocus] = useState<BenchFocus>("all");
  const [sort, setSort] = useState<BenchSort>("risk");
  const [assigneeId, setAssigneeId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const prefsRaw = useSyncExternalStore(subscribePrefs, readRawPrefs, () => null);
  const prefs = useMemo(() => parsePrefs(prefsRaw), [prefsRaw]);
  const view: BenchView = prefs.view ?? "coluna";
  const [expanded, setExpanded] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [pending, startMove] = useTransition();
  const [clock, setClock] = useState(nowIso);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [columnLane, setColumnLane] = useState<LaneStatus>(() => (BENCH_LANES.find((lane) => orders.some((order) => order.status === lane.status && lane.status === "em_montagem")) ?? BENCH_LANES.find((lane) => orders.some((order) => order.status === lane.status)) ?? BENCH_LANES[0]).status);
  const draggingOrder = orders.find((order) => order.id === draggingId);

  const updatePrefs = useCallback((change: (current: Prefs) => Prefs) => {
    writeRawPrefs(JSON.stringify(change(parsePrefs(readRawPrefs()))));
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString());
    const timer = window.setInterval(tick, 60000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);
  const now = useMemo(() => new Date(clock), [clock]);

  const effectiveFocus: BenchFocus = simple && !["all", "risk", "mine"].includes(focus) ? "all" : focus;
  const selectOptions = { query, focus: effectiveFocus, assigneeId: simple ? "" : assigneeId, sort: simple ? ("risk" as BenchSort) : sort, userId };
  const visible = selectBenchOrders(orders.filter((order) => !seller || (order.sellerName || "Sem vendedora") === seller), selectOptions, now);
  const people = Array.from(new Map(orders.flatMap((order) => order.steps.filter((step) => step.status === "em_andamento" && step.assigneeId).map((step) => [step.assigneeId!, step.assignee || "Responsável"] as const))).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const lateCount = orders.filter((order) => ["atrasada", "risco", "atencao"].includes(benchForecast(order, now).risk)).length;
  const runningCount = orders.filter((order) => order.steps.some((step) => step.status === "em_andamento")).length;
  const activeFilters = [seller, assigneeId, focus !== "all" ? focus : "", !simple && sort !== "risk" ? sort : ""].filter(Boolean).length;
  const shownLanes = BENCH_LANES.filter((lane) => !prefs.hidden.includes(lane.status));
  const sensors = useSensors(useSensor(KeyboardSensor), useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }));

  function laneOrders(status: LaneStatus) {
    const rows = visible.filter((order) => order.status === status);
    const laneSort = prefs.laneSort[status];
    return laneSort && !simple ? selectBenchOrders(rows, { ...selectOptions, sort: laneSort }, now) : rows;
  }

  function moveOrder(order: BenchOrder, target: string) {
    const lane = BENCH_LANES.find((item) => item.status === target);
    if (!lane || pending || lane.status === order.status) return;
    if (!canTransition(order.status, lane.status, role)) { setMoveError("Esta mudança não faz parte do fluxo ou do seu perfil. Use a próxima ação do cartão."); return; }
    if (lane.status === "em_correcao") { setMoveError("Abra os detalhes e registre o problema antes de enviar para correção."); return; }
    setMoveError(null);
    startMove(async () => {
      try {
        const result = await changeOrderStatus(order.id, lane.status, "Movimentação pelo Kanban da bancada");
        if (!result.ok) setMoveError(result.message);
        else toast.success(`OS ${visibleOrderNumber(order)}: ${STATUS_LABEL[lane.status]}`);
      } catch { setMoveError("Não foi possível confirmar a movimentação. Confira a conexão."); }
      finally { router.refresh(); }
    });
  }

  function followStatus(status: string) {
    const lane = BENCH_LANES.find((item) => item.status === status);
    if (lane) { viewportRef.current?.goTo(lane.status); setColumnLane(lane.status); }
    if (status === "pronto") setNotice("Serviço conferido e pronto. Agora ele aparece em Retirada e entrega.");
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const order = orders.find((item) => item.id === event.active.id);
    if (order && event.over) moveOrder(order, String(event.over.id));
  }

  const toggleExpanded = (id: string) => setExpanded((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const setLaneExpanded = (status: LaneStatus, open: boolean) => {
    const ids = laneOrders(status).map((order) => order.id);
    setExpanded((current) => (open ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id))));
  };
  const allExpanded = visible.length > 0 && visible.every((order) => expanded.includes(order.id));
  const clearFilters = () => { setQuery(""); setFocus("all"); setAssigneeId(""); setSeller(""); setSort("risk"); };

  return <div className="bk-board grid min-w-0 gap-3">
    {/* Cabeçalho e barra de ferramentas, como no Kanban do CRM */}
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--link)]">Produção · montagem</p>
        <h1 className="flex items-baseline gap-2 text-[26px] font-semibold tracking-tight">Bancada de montagem <span className="text-sm font-medium text-[var(--muted)]">{orders.length} OS</span></h1>
      </div>
      <div className="bk-segment" role="group" aria-label="Modo de visualização">
        <button type="button" aria-pressed={view === "coluna"} className={cn(view === "coluna" && "is-on")} onClick={() => updatePrefs((current) => ({ ...current, view: "coluna" }))}><Rows3 size={16} />Por coluna</button>
        <button type="button" aria-pressed={view === "kanban"} className={cn(view === "kanban" && "is-on")} onClick={() => updatePrefs((current) => ({ ...current, view: "kanban" }))}><Kanban size={16} />Kanban</button>
        <Link href="/montagem?view=lista"><LayoutList size={16} />Lista</Link>
      </div>
    </header>

    {!simple ? <div className="bk-stats" aria-label="Resumo da bancada">
      {([["Na bancada", orders.length, ""], ["Atenção aos prazos", lateCount, lateCount ? "warn" : ""], ["Etapa em execução", runningCount, ""], ["Em correção", orders.filter((order) => order.status === "em_correcao").length, orders.some((order) => order.status === "em_correcao") ? "late" : ""]] as const).map(([label, value, tone]) => <div key={label} className="bk-stat" data-tone={tone || undefined}><span>{label}</span><strong>{value}</strong></div>)}
    </div> : null}

    {view === "coluna" ? <>
      <Feedback error={moveError || error} />
      {notice ? <div role="status" className="rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--link)]">{notice}<Link href="/entrega" className="mt-2 block min-h-11 py-2 font-semibold underline">Ver serviços para retirada</Link></div> : null}
      <BenchColumns
        lanes={BENCH_LANES}
        orders={orders}
        visible={visible}
        lane={columnLane}
        onLane={setColumnLane}
        query={query}
        onQuery={setQuery}
        sort={sort}
        onSort={setSort}
        focus={focus}
        onFocus={setFocus}
        simple={simple}
        role={role}
        now={now}
        boardPending={pending}
        onProgress={followStatus}
      />
    </> : <>
    <div className="bk-toolbar">
      <label className="bk-search">
        <ScanLine size={17} aria-hidden />
        <span className="sr-only">Buscar na bancada</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bipe ou digite OS, cliente, vendedora" />
        {query ? <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")} className="bk-icon-btn is-small"><X size={14} /></button> : null}
      </label>
      <button type="button" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen} className={cn("bk-btn", (filtersOpen || activeFilters > 0) && "is-on")}>
        <SlidersHorizontal size={16} />Filtros{activeFilters ? <span className="bk-badge">{activeFilters}</span> : null}
      </button>
      <Menu label="Mostrar ou ocultar colunas" icon={<span className="bk-btn-inner"><Columns3 size={16} /><span className="hidden sm:inline">Colunas</span></span>} className="bk-menu-btn">
        {() => <>
          <p className="bk-menu-title">Colunas visíveis</p>
          {BENCH_LANES.map((lane) => {
            const on = !prefs.hidden.includes(lane.status);
            return <MenuItem key={lane.status} active={on} icon={<span className="bk-dot" style={stageStyle(lane.status)} />} disabled={on && shownLanes.length === 1} onClick={() => updatePrefs((current) => ({ ...current, hidden: on ? [...current.hidden, lane.status] : current.hidden.filter((item) => item !== lane.status) }))}>{lane.title}</MenuItem>;
          })}
          <MenuItem icon={<ArrowDownUp size={14} />} onClick={() => updatePrefs(() => EMPTY_PREFS)}>Restaurar padrão do quadro</MenuItem>
        </>}
      </Menu>
      <button type="button" onClick={() => setExpanded(allExpanded ? [] : visible.map((order) => order.id))} className="bk-btn" title={allExpanded ? "Recolher todos os cartões" : "Expandir todos os cartões"}>
        {allExpanded ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}<span className="hidden sm:inline">{allExpanded ? "Recolher" : "Expandir"}</span>
      </button>
      <span role="status" className="ml-auto text-xs text-[var(--muted)]">{visible.length} de {orders.length} OS{pending ? " · Salvando…" : ""}</span>
    </div>

    {filtersOpen ? <div className="bk-filters" role="region" aria-label="Filtros da bancada">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros rápidos">
        {([["all", "Todas"], ["risk", "Atenção aos prazos"], ["mine", "Minhas etapas"], ["unassigned", "Sem responsável"], ["critical", "Prioridade crítica"]] as const).filter(([value]) => !simple || ["all", "risk", "mine"].includes(value)).map(([value, label]) => <button key={value} type="button" onClick={() => setFocus(value)} aria-pressed={focus === value} className={cn("bk-chip", focus === value && "is-on")}>{label}</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="bk-field">Vendedora<select value={seller} onChange={(event) => setSeller(event.target.value)}><option value="">Todas as vendedoras</option>{sellerFilterNames(sellers, orders.map((order) => order.sellerName)).map((name) => <option key={name}>{name}</option>)}</select></label>
        {!simple ? <>
          <label className="bk-field">Responsável pela etapa<select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Todos os responsáveis</option>{people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className="bk-field">Ordenação<select value={sort} onChange={(event) => setSort(event.target.value as BenchSort)}>{(Object.keys(SORT_LABEL) as BenchSort[]).map((value) => <option key={value} value={value}>{SORT_LABEL[value]}</option>)}</select></label>
        </> : null}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={clearFilters} className="bk-btn">Limpar</button>
        <button type="button" onClick={() => setFiltersOpen(false)} className="bk-btn is-primary">Aplicar</button>
      </div>
    </div> : activeFilters > 0 ? <button type="button" onClick={clearFilters} className="justify-self-start text-xs font-semibold text-[var(--link)]">Limpar filtros ativos</button> : null}

    {notice ? <div role="status" className="rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--link)]">{notice}<Link href="/entrega" className="mt-2 block min-h-11 py-2 font-semibold underline">Ver serviços para retirada</Link></div> : null}
    <Feedback error={moveError || error} />

    <DndContext id={boardId} sensors={sensors} autoScroll={KANBAN_AUTO_SCROLL} collisionDetection={(args) => { const hits = pointerWithin(args); return hits.length ? hits : closestCenter(args); }} onDragStart={(event) => setDraggingId(String(event.active.id))} onDragCancel={() => setDraggingId(null)} onDragEnd={onDragEnd}>
      <KanbanViewport ref={viewportRef} label="Kanban da bancada" dragging={Boolean(draggingId)} lanes={shownLanes.map((lane) => ({ id: lane.status, label: lane.title, count: visible.filter((order) => order.status === lane.status).length }))}>
        {shownLanes.map((lane) => <BenchLane
          key={lane.status}
          lane={lane}
          orders={laneOrders(lane.status)}
          total={orders.filter((order) => order.status === lane.status).length}
          collapsed={prefs.collapsed.includes(lane.status)}
          width={prefs.widths[lane.status]}
          laneSort={prefs.laneSort[lane.status]}
          simple={simple}
          expanded={expanded}
          onToggleCard={toggleExpanded}
          onToggle={() => updatePrefs((current) => ({ ...current, collapsed: current.collapsed.includes(lane.status) ? current.collapsed.filter((item) => item !== lane.status) : [...current.collapsed, lane.status] }))}
          onHide={() => shownLanes.length > 1 && updatePrefs((current) => ({ ...current, hidden: [...current.hidden, lane.status] }))}
          onSort={(value) => updatePrefs((current) => ({ ...current, laneSort: { ...current.laneSort, [lane.status]: value } }))}
          onResize={(value) => updatePrefs((current) => ({ ...current, widths: { ...current.widths, [lane.status]: value } }))}
          onExpandAll={(open) => setLaneExpanded(lane.status, open)}
          role={role}
          now={now}
          pending={pending}
          onMove={moveOrder}
          onProgress={followStatus}
        />)}
      </KanbanViewport>
      <DragOverlay>{draggingOrder ? <div className="bk-card is-overlay" data-urgency={benchDeadlineSignal(draggingOrder, now).level} style={stageStyle(draggingOrder.status)}>
        <p className="bk-card-no">#{visibleOrderNumber(draggingOrder)}</p>
        <p className="bk-card-title">{draggingOrder.clientName}</p>
        <p className="bk-card-deadline">{benchDeadlineSignal(draggingOrder, now).label}</p>
      </div> : null}</DragOverlay>
    </DndContext>
    <p className="text-xs text-[var(--muted)]">Arraste o cartão para outra coluna (no celular, segure e arraste, ou use o menu ⋯ › Mover para). As preferências de colunas ficam salvas neste aparelho.</p>
    </>}
  </div>;
}

function BenchLane({ lane, orders, total, collapsed, width, laneSort, simple, expanded, onToggleCard, onToggle, onHide, onSort, onResize, onExpandAll, role, now, pending, onMove, onProgress }: {
  lane: typeof BENCH_LANES[number]; orders: BenchOrder[]; total: number; collapsed: boolean; width?: number; laneSort?: BenchSort; simple: boolean;
  expanded: string[]; onToggleCard: (id: string) => void; onToggle: () => void; onHide: () => void; onSort: (value: BenchSort) => void; onResize: (value: number) => void; onExpandAll: (open: boolean) => void;
  role: AppRole; now: Date; pending: boolean; onMove: (order: BenchOrder, status: string) => void; onProgress: (status: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.status });
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const style = { ...stageStyle(lane.status), ...(width || liveWidth ? { "--kanban-column-width": `${liveWidth ?? width}px` } : {}) } as CSSProperties;

  // Largura ajustável arrastando a borda direita da coluna (igual ao CRM).
  function startResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const column = event.currentTarget.closest("section");
    const startX = event.clientX;
    const startWidth = column?.getBoundingClientRect().width ?? 300;
    let latest = startWidth;
    const move = (moveEvent: PointerEvent) => { latest = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + moveEvent.clientX - startX))); setLiveWidth(latest); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); setLiveWidth(null); onResize(latest); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return <section id={`bench-lane-${lane.status}`} data-kanban-column={lane.status} data-collapsed={collapsed || undefined} ref={setNodeRef} style={style} className={cn("kanban-column bk-column", isOver && "is-over")}>
    {collapsed ? <h2 className="kanban-column-heading"><button type="button" onClick={onToggle} aria-expanded={false} aria-label={`Expandir coluna ${lane.title}`} className="kanban-column-strip"><ChevronRight size={16} /><span>{lane.title}</span><span>{orders.length}</span></button></h2> : <>
      <span className="bk-col-bar" aria-hidden />
      <header className="bk-col-head">
        <div className="bk-col-title">
          <button type="button" onClick={onToggle} aria-expanded aria-label={`Recolher coluna ${lane.title}`} className="bk-icon-btn is-small"><ChevronDown size={15} /></button>
          <h2 className="min-w-0 flex-1 truncate">{lane.title}</h2>
          <span className="bk-count">{orders.length}{orders.length !== total ? `/${total}` : ""}</span>
          <Menu label={`Opções da coluna ${lane.title}`} icon={<MoreHorizontal size={17} />}>
            {(close) => <>
              {!simple ? <>
                <p className="bk-menu-title">Ordenar esta coluna</p>
                {(Object.keys(SORT_LABEL) as BenchSort[]).map((value) => <MenuItem key={value} active={(laneSort ?? "risk") === value} onClick={() => { onSort(value); close(); }}>{SORT_LABEL[value]}</MenuItem>)}
                <hr className="bk-menu-sep" />
              </> : null}
              <MenuItem icon={<ChevronsUpDown size={14} />} onClick={() => { onExpandAll(true); close(); }}>Expandir todos os cartões</MenuItem>
              <MenuItem icon={<ChevronsDownUp size={14} />} onClick={() => { onExpandAll(false); close(); }}>Recolher todos os cartões</MenuItem>
              <MenuItem icon={<ChevronRight size={14} />} onClick={() => { onToggle(); close(); }}>Recolher coluna</MenuItem>
              <MenuItem icon={<EyeOff size={14} />} onClick={() => { onHide(); close(); }}>Ocultar coluna</MenuItem>
            </>}
          </Menu>
        </div>
        <p className="bk-col-meta"><span className="truncate">{lane.hint}</span><span>{orders.length === 1 ? "1 OS" : `${orders.length} OS`}</span></p>
      </header>
      <div className="kanban-column-body bk-col-body" data-kanban-column-body tabIndex={0} role="region" aria-label={`Serviços em ${lane.title}`}>
        {orders.length ? orders.map((order) => <BenchCard key={order.id} order={order} expanded={expanded.includes(order.id)} onToggle={() => onToggleCard(order.id)} role={role} now={now} boardPending={pending} onMove={onMove} onProgress={onProgress} />) : <p className="bk-col-empty">{total ? "Nenhuma OS corresponde aos filtros." : "Nenhuma OS nesta etapa."}</p>}
      </div>
      <button type="button" aria-label={`Ajustar largura da coluna ${lane.title}`} title="Arraste para ajustar a largura" onPointerDown={startResize} onDoubleClick={() => onResize(0)} className="bk-col-resize" />
    </>}
  </section>;
}

function PriorityBars({ order }: { order: BenchOrder }) {
  const level = order.urgent ? 3 : order.express_minutes ? 2 : 1;
  const label = order.urgent ? "Prioridade crítica" : order.express_minutes ? `Expressa ${order.express_minutes} min` : "Prioridade normal";
  return <span className="bk-prio" data-level={level} role="img" aria-label={label} title={label}><i /><i /><i /></span>;
}

function BenchCard({ order, expanded, onToggle, role, now, boardPending, onMove, onProgress }: { order: BenchOrder; expanded: boolean; onToggle: () => void; role: AppRole; now: Date; boardPending: boolean; onMove: (order: BenchOrder, status: string) => void; onProgress: (status: string) => void }) {
  const router = useRouter();
  const detailsId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const stepsDone = order.steps.filter((step) => step.status === "concluida").length;
  const forecast = benchForecast(order, now);
  const action = nextBenchAction(order, role);
  const targets = allowedTargets(order.status, role).filter((status) => BENCH_LANES.some((lane) => lane.status === status));
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: order.id, disabled: pending || boardPending || targets.length === 0 });
  const running = order.steps.find((step) => step.status === "em_andamento");
  const deadline = benchDeadlineSignal(order, now);
  const age = stageAge(order.stageSince, now);
  const number = visibleOrderNumber(order);
  const stop = { onMouseDown: (event: React.MouseEvent) => event.stopPropagation(), onTouchStart: (event: React.TouchEvent) => event.stopPropagation() };

  function run() {
    if (action.kind === "none" || pending || boardPending) return;
    setError(null);
    startTransition(async () => {
      try {
        let result;
        if (action.kind === "status") {
          result = await changeOrderStatus(order.id, action.to, action.note);
        } else {
          const data = new FormData();
          data.set("orderId", order.id);
          data.set("stepKey", action.step);
          data.set("action", action.action);
          result = await advanceStep(data);
        }
        if (!result.ok) setError(result.message ?? "Não foi possível registrar.");
        else {
          toast.success(action.kind === "status" ? `OS ${number}: ${STATUS_LABEL[action.to]}` : "Etapa registrada com sucesso.");
          if (action.kind === "status") onProgress(action.to);
          router.refresh();
        }
      } catch { setError("Não foi possível registrar. Confira a conexão e tente novamente."); }
    });
  }

  return (
    <article
      ref={(node) => { setNodeRef(node); setActivatorNodeRef(node); }}
      data-kanban-card
      data-urgency={deadline.level}
      style={stageStyle(order.status)}
      className={cn("bk-card", isDragging && "is-dragging", pending && "opacity-80", targets.length > 0 && "is-draggable")}
      {...(targets.length > 0 ? listeners : {})}
      {...(targets.length > 0 ? attributes : {})}
      aria-roledescription={targets.length > 0 ? "cartão arrastável" : undefined}
    >
      {/* Linha de cima: número, prioridade, tempo na etapa e menu */}
      <div className="bk-card-top">
        {targets.length > 0 ? <GripVertical size={14} className="bk-grip" aria-hidden /> : null}
        <Link href={`/montagem?os=${order.id}`} scroll={false} className="bk-card-no" {...stop}>#{number}</Link>
        <PriorityBars order={order} />
        <span className="flex-1" />
        {age ? <span className="bk-age" data-tone={age.tone} title={age.title}><Clock3 size={12} />{age.label}</span> : null}
        <Menu label={`Ações da OS ${number}`} icon={<MoreHorizontal size={16} />}>
          {(close) => <>
            <Link role="menuitem" href={`/montagem?os=${order.id}`} scroll={false} onClick={close} className="bk-menu-item"><ExternalLink size={14} /><span className="flex-1">Abrir detalhes</span></Link>
            <MenuItem icon={expanded ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />} onClick={() => { onToggle(); close(); }}>{expanded ? "Recolher cartão" : "Expandir cartão"}</MenuItem>
            {targets.length ? <>
              <hr className="bk-menu-sep" />
              <p className="bk-menu-title">Mover para</p>
              {targets.map((status) => <MenuItem key={status} icon={<span className="bk-dot" style={stageStyle(status)} />} disabled={pending || boardPending} onClick={() => { onMove(order, status); close(); }}>{STATUS_LABEL[status]}</MenuItem>)}
            </> : null}
          </>}
        </Menu>
      </div>

      {/* Corpo resumido: clique abre/fecha os detalhes */}
      <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={onToggle} className="bk-card-main">
        <span className="bk-card-title">{order.clientName}</span>
        {order.serviceDescription ? <span className="bk-card-desc">{order.serviceDescription}</span> : null}
        <span className="bk-card-tags">
          {order.medical_review_required ? <span className="bk-tag" data-tone="warn">Conferência médica</span> : null}
          {order.assistance_kind ? <span className="bk-tag" data-tone="info">Assistência · {order.assistance_kind}</span> : null}
          {(order.openOccurrences ?? 0) > 0 ? <span className="bk-tag" data-tone="late">{order.openOccurrences} ocorrência(s)</span> : null}
        </span>
        <span className="bk-card-person">{[order.storeName, order.sellerName].filter(Boolean).join(" · ") || "Sem loja ou vendedora"}</span>
      </button>
      <ExpressCountdown operations={order} nowIso={now.toISOString()} />

      {/* Progresso das etapas, como o checklist do CRM */}
      <div className="bk-checks" title={`${stepsDone} de 5 etapas registradas (opcionais)`}>
        <span className="bk-checks-bar"><span style={{ width: `${stepsDone * 20}%` }} /></span>
        <span>Etapas {stepsDone}/5</span>
      </div>

      <div className="bk-card-foot">
        <span className="bk-due" title={order.dueAt ? `Prazo ${formatDateTime(order.dueAt)}` : undefined}>{deadline.label}{order.dueAt ? ` · ${dueDeltaLabel(order.dueAt, now, order.status)}` : ""}</span>
        <span className="flex-1" />
        {running ? <span className="bk-avatar" title={`${STEP_LABEL[running.key]} com ${running.assignee ?? "responsável"} desde ${timeOf(running.startedAt)}`}>{initials(running.assignee)}</span> : null}
        <button type="button" onClick={onToggle} aria-label={expanded ? "Recolher cartão" : "Expandir cartão"} className="bk-icon-btn is-small" {...stop}>{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
      </div>

      {action.kind === "none" ? (
        expanded ? <p className="bk-next is-idle">{action.label}</p> : null
      ) : (
        <button type="button" onClick={run} disabled={pending || boardPending} className={cn("lg-bench-action bk-next", action.kind === "status" && action.to === "pronto" && "is-done")} {...stop}>
          {action.kind === "step" && action.action === "concluir" ? <Check size={16} /> : <Play size={14} />}
          {pending ? "Registrando..." : action.label}
        </button>
      )}
      {error ? <Feedback error={error} /> : null}

      <div id={detailsId} hidden={!expanded} className="bk-card-details" {...stop}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-[var(--muted)]">
            <p>{order.dueAt ? `Prazo ${formatDateTime(order.dueAt)}` : "Sem prazo definido"}</p>
            <p className="mt-1">{order.laboratoryName || "Sem laboratório"}</p>
          </div>
          <LensGauge value={stepsDone * 20} risk={forecast.risk} size={60} />
        </div>
        {can(role, "orders.write") && <QuickOrderPhoto orderId={order.id} stepKey={running?.key} />}
        {order.openOccurrences ? <Link href={`/montagem?os=${order.id}`} scroll={false} className="rounded-lg bg-[var(--danger-soft)] px-2.5 py-2 text-xs font-semibold text-[var(--danger)]">{order.openOccurrences} ocorrência(s) de qualidade aberta(s) · verificar</Link> : null}
        <ol className="grid gap-1.5 rounded-lg bg-[var(--background)] p-2.5" aria-label="Etapas da montagem">
          {STEP_KEYS.map((key) => {
            const step = order.steps.find((item) => item.key === key);
            const status = step?.status ?? "pendente";
            return <li key={key} className="flex items-start gap-2 text-xs" title={step?.assignee || undefined}>
              <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border", status === "concluida" ? "border-[var(--focus)] bg-[var(--accent)] text-white" : status === "em_andamento" ? "border-[var(--focus)] text-[var(--link)]" : status === "reprovada" ? "border-[var(--danger)] text-[var(--danger)]" : "border-[var(--line)] text-[var(--muted)]")}>{status === "concluida" ? <Check size={11} /> : status === "em_andamento" ? <Play size={9} /> : status === "reprovada" ? "!" : null}</span>
              <span className="min-w-0 flex-1">{SHORT[key]}</span><span className={cn("text-right text-[11px]", status === "em_andamento" ? "font-semibold text-[var(--link)]" : "text-[var(--muted)]")}>{step ? STEP_STATUS_LABEL[status] : "Não cadastrada"}</span>
            </li>;
          })}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span className="min-w-0 break-words">
            {running ? <><Wrench size={12} className="mr-1 inline align-[-1px]" />{STEP_LABEL[running.key]} desde {timeOf(running.startedAt)}{running.assignee ? ` com ${running.assignee.split(" ")[0]}` : ""}</>
              : forecast.slackHours !== null && forecast.risk !== "pronta" ? (forecast.slackHours >= 0 ? `Folga de ${formatHoursShort(forecast.slackHours)} no prazo` : `Previsão excede o prazo em ${formatHoursShort(-forecast.slackHours)}`)
              : "Sem prazo definido"}
          </span>
          <RiskChip risk={forecast.risk} />
        </div>
        {targets.length > 0 ? <label className="flex items-center gap-2 text-xs text-[var(--muted)]">Mover para<select aria-label={`Mover OS ${number} para`} value="" disabled={pending || boardPending} onChange={(event) => { if (event.target.value) onMove(order, event.target.value); }} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-[var(--ink)]"><option value="">Escolher status</option>{targets.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</select></label> : null}
        <Link href={`/montagem?os=${order.id}`} scroll={false} className="flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] text-xs font-semibold text-[var(--link)] hover:bg-[var(--background)]">Detalhes, fotos e histórico</Link>
      </div>
    </article>
  );
}

/* ===== Bancada "por coluna" (versão limpa): colunas à esquerda e a lista da coluna à direita ===== */
const FOCUS_OPTIONS: [BenchFocus, string][] = [["all", "Todas"], ["risk", "Em risco"], ["mine", "Minhas"], ["unassigned", "Sem responsável"], ["critical", "Críticas"]];
const SHORT_SORT: Record<BenchSort, string> = { risk: "Risco", deadline: "Prazo", oldest: "Mais antigas" };

function BenchColumns({ lanes, orders, visible, lane, onLane, query, onQuery, sort, onSort, focus, onFocus, simple, role, now, boardPending, onProgress }: {
  lanes: typeof BENCH_LANES; orders: BenchOrder[]; visible: BenchOrder[]; lane: LaneStatus; onLane: (status: LaneStatus) => void;
  query: string; onQuery: (value: string) => void; sort: BenchSort; onSort: (value: BenchSort) => void; focus: BenchFocus; onFocus: (value: BenchFocus) => void;
  simple: boolean; role: AppRole; now: Date; boardPending: boolean; onProgress: (status: string) => void;
}) {
  const selected = lanes.find((item) => item.status === lane) ?? lanes[0];
  const rows = visible.filter((order) => order.status === selected.status);
  const focusOptions = FOCUS_OPTIONS.filter(([value]) => !simple || ["all", "risk", "mine"].includes(value));
  return (
    <div className="bc-wrap">
      <nav className="bc-lanes" aria-label="Colunas da bancada">
        {lanes.map((item) => {
          const count = visible.filter((order) => order.status === item.status).length;
          const late = orders.some((order) => order.status === item.status && ["late", "critical"].includes(benchDeadlineSignal(order, now).level));
          return (
            <button key={item.status} type="button" aria-pressed={item.status === selected.status} onClick={() => onLane(item.status)} className="bc-lane" style={stageStyle(item.status)}>
              <span className="bc-dot" aria-hidden />
              <span className="bc-lane-text"><span className="bc-lane-title">{item.title}</span><span className="bc-lane-hint">{item.hint}</span></span>
              <span className="bc-count" data-alert={late || undefined} aria-label={`${count} OS${late ? ", com atraso" : ""}`}>{count}</span>
            </button>
          );
        })}
      </nav>
      <section className="bc-main" aria-label={`OS em ${selected.title}`}>
        <header className="bc-head">
          <div className="mr-auto min-w-0">
            <h2 className="text-[17px] font-semibold">{selected.title}</h2>
            <p className="text-[12.5px] text-[var(--muted)]">{selected.hint}</p>
          </div>
          <label className="bc-search"><Search size={16} aria-hidden /><span className="sr-only">Buscar na bancada</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Bipe ou busque OS, cliente, vendedora" />{query ? <button type="button" aria-label="Limpar busca" onClick={() => onQuery("")} className="bk-icon-btn is-small"><X size={14} /></button> : null}</label>
          {!simple ? <label className="bc-sort">Ordenar<select value={sort} onChange={(event) => onSort(event.target.value as BenchSort)}>{(Object.keys(SHORT_SORT) as BenchSort[]).map((value) => <option key={value} value={value}>{SHORT_SORT[value]}</option>)}</select></label> : null}
        </header>
        <div className="bc-focus" role="group" aria-label="Filtros rápidos">
          {focusOptions.map(([value, label]) => <button key={value} type="button" aria-pressed={focus === value} onClick={() => onFocus(value)} className={cn("bk-chip", focus === value && "is-on")}>{label}</button>)}
          <span role="status" className="ml-auto self-center text-xs text-[var(--muted)]">{rows.length} OS{boardPending ? " · Salvando…" : ""}</span>
        </div>
        <ul className="bc-list">
          {rows.length ? rows.map((order) => <BenchRow key={order.id} order={order} role={role} now={now} boardPending={boardPending} onProgress={onProgress} />) : <li className="bc-empty">{orders.some((order) => order.status === selected.status) ? "Nenhuma OS nesta coluna com esse filtro." : "Nenhuma OS nesta coluna."}</li>}
        </ul>
      </section>
    </div>
  );
}

function BenchRow({ order, role, now, boardPending, onProgress }: { order: BenchOrder; role: AppRole; now: Date; boardPending: boolean; onProgress: (status: string) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const action = nextBenchAction(order, role);
  const deadline = benchDeadlineSignal(order, now);
  const running = order.steps.find((step) => step.status === "em_andamento");
  const number = visibleOrderNumber(order);
  const age = stageAge(order.stageSince, now);
  const tone = deadline.level === "late" || deadline.level === "critical" ? "late" : deadline.level === "soon" || deadline.level === "attention" ? "soon" : "ok";
  const who = running ? `${STEP_LABEL[running.key]}${running.assignee ? ` com ${running.assignee.split(" ")[0]}` : ""}` : order.status === "aguardando_montagem" ? "aguardando" : age ? `nesta coluna há ${age.label}` : "";

  function run() {
    if (action.kind === "none" || pending || boardPending) return;
    setError(null);
    startTransition(async () => {
      try {
        let result;
        if (action.kind === "status") result = await changeOrderStatus(order.id, action.to, action.note);
        else {
          const data = new FormData();
          data.set("orderId", order.id);
          data.set("stepKey", action.step);
          data.set("action", action.action);
          result = await advanceStep(data);
        }
        if (!result.ok) setError(result.message ?? "Não foi possível registrar.");
        else {
          toast.success(action.kind === "status" ? `OS ${number}: ${STATUS_LABEL[action.to]}` : "Etapa registrada com sucesso.");
          if (action.kind === "status") onProgress(action.to);
          router.refresh();
        }
      } catch { setError("Não foi possível registrar. Confira a conexão e tente novamente."); }
    });
  }

  return (
    <li className="bc-row">
      <span className="bc-avatar" data-tone={tone} aria-hidden>{initials(order.clientName)}</span>
      <div className="bc-row-body">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="text-[15px] font-semibold">{order.clientName}</span>
            <span className="bc-signal" data-tone={tone}>{deadline.label}{order.dueAt && order.status !== "pronto" ? ` · ${dueDeltaLabel(order.dueAt, now, order.status)}` : ""}</span>
            {order.urgent ? <span className="lg-badge">urgente</span> : null}
            {order.medical_review_required ? <span className="bk-tag" data-tone="warn">Conferência médica</span> : null}
            {(order.openOccurrences ?? 0) > 0 ? <span className="bk-tag" data-tone="late">{order.openOccurrences} ocorrência(s)</span> : null}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-[var(--muted)]"><span className="font-mono text-xs">{number}</span>{order.sellerName ? ` · ${order.sellerName}` : ""}{who ? ` · ${who}` : ""}</p>
          <ExpressCountdown operations={order} nowIso={now.toISOString()} />
          {error ? <Feedback error={error} /> : null}
        </div>
        <Link href={`/montagem?os=${order.id}`} scroll={false} className="bc-details">Detalhes</Link>
        {action.kind !== "none" ? <button type="button" onClick={run} disabled={pending || boardPending} className="bc-action">{pending ? "Registrando..." : action.label}</button> : <span className="bc-idle">{action.label}</span>}
      </div>
    </li>
  );
}
