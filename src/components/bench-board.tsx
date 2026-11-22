"use client";
import {ExpressCountdown} from "./order-operations";

import { QuickOrderPhoto } from "./quick-order-photo";
import { can } from "@/lib/domain/permissions";
import { Check, ChevronDown, ChevronRight, GripVertical, LayoutList, Play, ScanLine, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useOperationMode } from "./operation-mode";
import { RiskChip } from "@/components/forecast-ui";
import { Feedback } from "@/components/ui";
import { DndContext, DragOverlay, KeyboardSensor, closestCenter, pointerWithin, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { BENCH_LANES, benchDeadlineSignal, benchForecast, nextBenchAction, selectBenchOrders, type BenchOrder, type BenchFocus, type BenchSort } from "@/lib/domain/bench";
export type { BenchOrder } from "@/lib/domain/bench";
import { STEP_KEYS, STEP_LABEL, STEP_STATUS_LABEL, STATUS_LABEL, type AppRole, type StepKey } from "@/lib/domain/constants";
import { formatHoursShort } from "@/lib/domain/forecast";
import { dueDeltaLabel } from "@/lib/domain/urgency";
import { formatDateTime } from "@/lib/format";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { allowedTargets, canTransition } from "@/lib/domain/status";
import { cn } from "@/lib/utils";
import { advanceStep, changeOrderStatus } from "@/server/actions";

function timeOf(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

const SHORT: Record<StepKey, string> = { conferencia_inicial: "Conferência", lensometria: "Lensometria", blocagem: "Blocagem", facetadora: "Facetadora", conferencia_qualidade: "Qualidade" };

export function BenchBoard({ orders, role, error, nowIso, userId = "" }: { orders: BenchOrder[]; role: AppRole; error: string | null; nowIso: string; userId?: string }) {
  const router = useRouter();
  const { simple } = useOperationMode();
  const boardId = useId();
  const [activeLane, setActiveLane] = useState<BenchOrder["status"]>(() => BENCH_LANES.find((lane) => orders.some((order) => order.status === lane.status))?.status ?? "aguardando_montagem");
  const [query, setQuery] = useState("");
  const [seller,setSeller]=useState("");
  const [focus, setFocus] = useState<BenchFocus>("all");
  const [sort, setSort] = useState<BenchSort>("risk");
  const [assigneeId, setAssigneeId] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [pending, startMove] = useTransition();
  const [clock,setClock] = useState(nowIso);
  const [draggingId,setDraggingId] = useState<string|null>(null);
  const draggingOrder = orders.find(order=>order.id===draggingId);
  useEffect(()=>{
    const tick=()=>setClock(new Date().toISOString());
    const timer=window.setInterval(tick,60000);
    window.addEventListener("focus",tick);
    return ()=>{window.clearInterval(timer);window.removeEventListener("focus",tick);};
  },[]);
  const now = useMemo(() => new Date(clock), [clock]);
  const visible = selectBenchOrders(orders.filter(order=>!seller||(order.sellerName||"Sem vendedora")===seller), { query, focus: simple && !["all", "risk", "mine"].includes(focus) ? "all" : focus, assigneeId: simple ? "" : assigneeId, sort: simple ? "risk" : sort, userId }, now);
  const people = Array.from(new Map(orders.flatMap((order) => order.steps.filter((step) => step.status === "em_andamento" && step.assigneeId).map((step) => [step.assigneeId!, step.assignee || "Responsável"] as const))).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const lateCount = orders.filter((order) => ["atrasada", "risco", "atencao"].includes(benchForecast(order, now).risk)).length;
  const runningCount = orders.filter((order) => order.steps.some((step) => step.status === "em_andamento")).length;
  const sensors = useSensors(useSensor(KeyboardSensor), useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));

  function moveOrder(order: BenchOrder, target: string) {
    const lane = BENCH_LANES.find((item) => item.status === target);
    if (!lane || pending || lane.status === order.status) return;
    if (!canTransition(order.status, lane.status, role)) { setMoveError("Esta mudança não faz parte do fluxo ou do seu perfil. Use a próxima ação do cartão."); return; }
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
    if (!simple) return;
    const lane = BENCH_LANES.find((item) => item.status === status);
    if (lane) { setActiveLane(lane.status); document.getElementById(`bench-lane-${lane.status}`)?.scrollIntoView({block:"nearest",inline:"center"}); }
    if (status === "pronto") setNotice("Serviço conferido e pronto. Agora ele aparece em Retirada e entrega.");
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const order = orders.find((item) => item.id === event.active.id);
    if (order && event.over) moveOrder(order, String(event.over.id));
  }

  return <div className="lab-operational-filters grid min-w-0 gap-3">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--link)]">Produção · montagem</p><h1 className="text-[26px] font-semibold tracking-tight">Bancada de montagem</h1><p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">Priorize o prazo, acompanhe cada etapa e registre a próxima ação sem sair do quadro.</p></div>
      <Link href="/montagem?view=lista" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold"><LayoutList size={16} />Ver em lista</Link>
    </header>
    {!simple ? <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Resumo da bancada">
      {[["Na bancada", orders.length, "Serviços carregados"], ["Atenção aos prazos", lateCount, "Atraso ou folga curta"], ["Etapa em execução", runningCount, "Responsável registrado"], ["Em correção", orders.filter((order) => order.status === "em_correcao").length, "Acompanhar retrabalho"]].map(([label, value, hint]) => <div key={label} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"><p className="text-xs font-medium text-[var(--muted)]">{label}</p><p className="my-1 font-mono text-2xl font-semibold text-[var(--ink)]">{value}</p><p className="hidden text-xs text-[var(--muted)] sm:block">{hint}</p></div>)}
    </div> : null}
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <label className="min-w-48 flex-1 text-xs font-medium text-[var(--muted)]">Buscar na bancada<div className="mt-1 flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 focus-within:ring-2 focus-within:ring-[var(--focus)]/20"><ScanLine size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bipe ou digite OS, cliente, vendedor" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div></label>
      {!simple ? <><label className="text-xs font-medium text-[var(--muted)]">Responsável pela etapa<select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="mt-1 block min-h-11 max-w-56 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"><option value="">Todos os responsáveis</option>{people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="text-xs font-medium text-[var(--muted)]">Ordenação<select value={sort} onChange={(event) => setSort(event.target.value as BenchSort)} className="mt-1 block min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"><option value="risk">Maior risco primeiro</option><option value="deadline">Prazo mais próximo</option><option value="oldest">Entrada mais antiga</option></select></label></> : null}
    </div>
    <label className="text-sm font-semibold">Vendedora<select value={seller} onChange={event=>setSeller(event.target.value)} className="ml-2 min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3"><option value="">Todas as vendedoras</option>{Array.from(new Set(orders.map(order=>order.sellerName||"Sem vendedora"))).sort().map(name=><option key={name}>{name}</option>)}</select></label>
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Foco da bancada">
      {([["all", "Todas"], ["risk", "Atenção aos prazos"], ["mine", "Minhas etapas em execução"], ["unassigned", "Sem responsável em execução"], ["critical", "Prioridade crítica"]] as const).filter(([value]) => !simple || ["all", "risk", "mine"].includes(value)).map(([value, label]) => <button key={value} type="button" onClick={() => setFocus(value)} aria-pressed={focus === value} className={cn("min-h-11 rounded-lg border px-3 text-xs font-semibold", focus === value ? "border-[var(--focus)] bg-[var(--accent-soft)] text-[var(--link)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]")}>{label}</button>)}
      <span role="status" className="ml-auto text-xs text-[var(--muted)]">{visible.length} de {orders.length} OS{pending ? " · Salvando…" : ""}</span>
      {query || focus !== "all" || assigneeId || seller ? <button type="button" onClick={() => { setQuery(""); setFocus("all"); setAssigneeId(""); setSeller(""); }} className="min-h-11 px-2 text-xs font-semibold text-[var(--link)]">Limpar filtros</button> : null}
    </div>
    {simple ? <><details className="text-sm text-[var(--muted)]"><summary className="inline-flex min-h-11 items-center font-medium text-[var(--link)]">Como usar a bancada</summary><p className="max-w-3xl pb-2">Arraste pela alça entre as colunas ou expanda o cartão para iniciar processos e anexar fotos. Vermelho indica atraso ou prioridade alta; laranja e amarelo indicam prazo próximo.</p></details><div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Escolher fila de montagem">{BENCH_LANES.map((lane) => <button key={lane.status} type="button" onClick={() => {setActiveLane(lane.status);document.getElementById(`bench-lane-${lane.status}`)?.scrollIntoView({block:"nearest",inline:"center"});}} aria-pressed={activeLane === lane.status} className={cn("min-h-14 rounded-xl border px-3 py-2 text-left text-sm font-semibold", activeLane === lane.status ? "border-[var(--focus)] bg-[var(--accent)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]")}>{lane.title}<span className="ml-2 font-mono">{visible.filter((order) => order.status === lane.status).length}</span></button>)}</div></> : <p className="text-xs text-[var(--muted)]">Arraste pela alça ou use “Mover para”. A próxima ação registra cada etapa; mover a OS não conclui etapas. Filtros aplicados às até 200 OS carregadas.</p>}
    {notice ? <div role="status" className="rounded-xl border border-[var(--edge-b5ddd0)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--link)]">{notice}<Link href="/entrega" className="mt-2 block min-h-11 py-2 font-semibold underline">Ver serviços para retirada</Link></div> : null}
    <Feedback error={moveError || error} />
    <DndContext id={boardId} sensors={sensors} collisionDetection={args=>{const hits=pointerWithin(args);return hits.length?hits:closestCenter(args);}} onDragStart={event=>setDraggingId(String(event.active.id))} onDragCancel={()=>setDraggingId(null)} onDragEnd={onDragEnd}>
      <div className="-mx-3 flex min-w-0 snap-x snap-mandatory items-start gap-3 overflow-x-auto px-3 pb-4 md:mx-0 md:px-0 md:snap-none" aria-label="Kanban da bancada">
        {BENCH_LANES.map((lane) => <BenchLane key={lane.status} lane={lane} orders={visible.filter((order) => order.status === lane.status)} total={orders.filter((order) => order.status === lane.status).length} collapsed={collapsed.includes(lane.status)} onToggle={() => setCollapsed((current) => current.includes(lane.status) ? current.filter((status) => status !== lane.status) : [...current, lane.status])} role={role} now={now} pending={pending} onMove={moveOrder} onProgress={followStatus} />)}
      </div>
      <DragOverlay>{draggingOrder ? <div className="bench-compact-card w-[300px] rounded-xl border p-3 shadow-xl" data-urgency={benchDeadlineSignal(draggingOrder,now).level}><p className="text-xs font-semibold">OS {visibleOrderNumber(draggingOrder)}</p><p className="mt-1 text-base font-semibold">{draggingOrder.clientName}</p><p className="mt-2 text-xs">{draggingOrder.dueAt?formatDateTime(draggingOrder.dueAt):"Sem prazo"}</p><p className="bench-deadline-label mt-1 text-xs font-semibold">{benchDeadlineSignal(draggingOrder,now).label}</p></div> : null}</DragOverlay>
    </DndContext>
  </div>;
}

function BenchLane({ lane, orders, total, collapsed, onToggle, role, now, pending, onMove, onProgress }: { lane: typeof BENCH_LANES[number]; orders: BenchOrder[]; total: number; collapsed: boolean; onToggle: () => void; role: AppRole; now: Date; pending: boolean; onMove: (order: BenchOrder, status: string) => void; onProgress: (status: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.status });
  return <section id={`bench-lane-${lane.status}`} ref={setNodeRef} className={cn("flex min-h-52 w-[min(88vw,340px)] shrink-0 snap-start flex-col gap-3 rounded-xl bg-[var(--bg-e8eeee)] p-2.5 md:w-[328px]", isOver && "ring-2 ring-[var(--focus)]")}>
    <header className="flex items-start gap-2 px-1"><span className="mt-4 h-2 w-2 shrink-0 rounded-sm" style={{ background: lane.color }} /><div className="min-w-0 flex-1"><h2><button type="button" onClick={onToggle} aria-expanded={!collapsed} className="flex min-h-11 w-full items-center gap-1 text-left text-sm font-semibold">{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{lane.title}</button></h2><p className="text-xs text-[var(--muted)]">{lane.hint}</p></div><span className="mt-3 font-mono text-xs text-[var(--muted)]" title={`${orders.length} visíveis de ${total}`}>{orders.length === total ? total : `${orders.length}/${total}`}</span></header>
    {!collapsed && (orders.length ? <div className="grid gap-2">{orders.map((order) => <BenchCard key={order.id} order={order} role={role} now={now} boardPending={pending} onMove={onMove} onProgress={onProgress} />)}</div> : <p className="rounded-lg border border-dashed border-[var(--edge-c5d1d2)] px-3 py-8 text-center text-xs text-[var(--muted)]">{total ? "Nenhuma OS corresponde aos filtros." : "Nenhuma OS nesta etapa."}</p>)}
  </section>;
}

function BenchCard({ order, role, now, boardPending, onMove, onProgress }: { order: BenchOrder; role: AppRole; now: Date; boardPending: boolean; onMove: (order: BenchOrder, status: string) => void; onProgress: (status: string) => void }) {
  const router = useRouter();
  const [expanded,setExpanded] = useState(false);
  const detailsId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const stepsDone = order.steps.filter((step) => step.status === "concluida").length;
  const forecast = benchForecast(order, now);
  const action = nextBenchAction(order, role);
  const targets = allowedTargets(order.status, role).filter((status) => BENCH_LANES.some((lane) => lane.status === status));
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id, disabled: pending || boardPending || targets.length === 0 });
  const running = order.steps.find((step) => step.status === "em_andamento");
  const deadline = benchDeadlineSignal(order,now);

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
        toast.success(action.kind === "status" ? `OS ${visibleOrderNumber(order)}: ${STATUS_LABEL[action.to]}` : "Etapa registrada com sucesso.");
        if (action.kind === "status") onProgress(action.to);
        router.refresh();
      }
      } catch { setError("Não foi possível registrar. Confira a conexão e tente novamente."); }
    });
  }

  return (
    <article
      ref={setNodeRef}
      data-urgency={deadline.level}
      className={cn("bench-compact-card grid gap-2 rounded-xl border p-3", isDragging && "opacity-30", pending && "opacity-80")}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/montagem?os=${order.id}`} scroll={false} className="min-w-0 break-words font-mono text-xs font-semibold text-[var(--link)]">OS {visibleOrderNumber(order)}</Link>
        <div className="flex shrink-0 items-center gap-1"><span className="text-xs text-[var(--muted)]">{stepsDone}/5</span>{targets.length>0 && <button type="button" aria-label={`Arrastar OS ${visibleOrderNumber(order)}`} title="Arrastar para outra coluna" className="flex h-11 w-11 touch-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--accent-soft)] cursor-grab active:cursor-grabbing" {...listeners} {...attributes}><GripVertical size={19}/></button>}</div>
      </div>
      <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={()=>setExpanded(value=>!value)} className="grid min-h-11 gap-1.5 text-left">
        <span className="flex items-start gap-2"><span className="min-w-0 flex-1 break-words text-base font-semibold leading-snug">{order.clientName}</span>{expanded?<ChevronDown size={18}/>:<ChevronRight size={18}/>}</span>
        {order.serviceDescription?.startsWith("Manutenção — ") && <span className="break-words text-xs font-medium text-[var(--link)]">{order.serviceDescription}</span>}
        <ExpressCountdown operations={order} nowIso={now.toISOString()}/>
        <span className="text-xs font-semibold">{order.dueAt?`Prazo ${formatDateTime(order.dueAt)}`:"Sem prazo definido"}</span>
        <span className="bench-deadline-label text-xs font-bold">{deadline.label}{order.dueAt?` · ${dueDeltaLabel(order.dueAt,now,order.status)}`:""}</span>
        {(order.openOccurrences??0)>0 && <span className="text-xs font-semibold text-[var(--danger)]">{order.openOccurrences} ocorrência(s) aberta(s)</span>}
        <span className="mt-1 text-xs font-medium text-[var(--muted)]">{expanded?"Recolher cartão":"Expandir · processos e fotos"}{pending?" · Salvando…":""}</span>
      </button>
      <div id={detailsId} hidden={!expanded}>
      <div className="grid gap-3 border-t border-[var(--line)] pt-3">
        <div className="text-xs text-[var(--muted)]"><p>{[order.storeName,order.sellerName].filter(Boolean).join(" · ")||"Sem loja ou vendedor"}</p><p className="mt-1">{order.laboratoryName||"Sem laboratório"}</p></div>
      {can(role,"orders.write") && <QuickOrderPhoto orderId={order.id} stepKey={running?.key}/>}
      {order.openOccurrences ? <Link href={`/montagem?os=${order.id}`} scroll={false} className="rounded-lg bg-[var(--danger-soft)] px-2.5 py-2 text-xs font-semibold text-[var(--danger)]">{order.openOccurrences} ocorrência(s) de qualidade aberta(s) · verificar</Link> : null}
      <details open className="rounded-lg bg-[var(--background)] p-2.5">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm"><span className="font-semibold">Ver etapas da montagem</span><span className="font-mono text-[var(--muted)]">{stepsDone}/5</span></summary>
        <ol className="grid gap-1.5" aria-label="Etapas da montagem">
          {STEP_KEYS.map((key) => {
            const step = order.steps.find((item) => item.key === key);
            const status = step?.status ?? "pendente";
            return <li key={key} className="flex items-start gap-2 text-xs" title={step?.assignee || undefined}>
              <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border", status === "concluida" ? "border-[var(--focus)] bg-[var(--accent)] text-white" : status === "em_andamento" ? "border-[var(--focus)] text-[var(--link)]" : status === "reprovada" ? "border-[var(--danger)] text-[var(--danger)]" : "border-[var(--line)] text-[var(--muted)]")}>{status === "concluida" ? <Check size={11} /> : status === "em_andamento" ? <Play size={9} /> : status === "reprovada" ? "!" : null}</span>
              <span className="min-w-0 flex-1">{SHORT[key]}</span><span className={cn("text-right text-[11px]", status === "em_andamento" ? "font-semibold text-[var(--link)]" : "text-[var(--muted)]")}>{step ? STEP_STATUS_LABEL[status] : "Não cadastrada"}</span>
            </li>;
          })}
        </ol>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span className="min-w-0 break-words">
          {running ? (
            <>
              <Wrench size={12} className="mr-1 inline align-[-1px]" />
              {STEP_LABEL[running.key]} desde {timeOf(running.startedAt)}
              {running.assignee ? ` com ${running.assignee.split(" ")[0]}` : ""}
            </>
          ) : forecast.slackHours !== null && forecast.risk !== "pronta" ? (
            forecast.slackHours >= 0 ? (
              `Folga de ${formatHoursShort(forecast.slackHours)} no prazo`
            ) : (
              `Previsão excede o prazo em ${formatHoursShort(-forecast.slackHours)}`
            )
          ) : (
            "Sem prazo definido"
          )}
        </span>
        <RiskChip risk={forecast.risk} />
      </div>

      {action.kind === "none" ? (
        <p className="rounded-lg bg-[var(--accent-soft)] px-3 py-2.5 text-center text-sm font-medium text-[var(--muted)]">{action.label}</p>
      ) : (
        <button
          type="button"
          onClick={run}
          disabled={pending || boardPending}
          className={cn(
            "flex min-h-12 w-full px-2 py-2 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus)]/30 disabled:opacity-60",
            action.kind === "status" && action.to === "pronto"
              ? "bg-[var(--bg-2e7d5b)] hover:bg-[var(--bg-18723f)]"
              : action.kind === "step" && action.action === "concluir"
                ? "bg-[var(--accent-strong)] hover:bg-[var(--bg-08463f)]"
                : "bg-[var(--accent)] hover:bg-[var(--accent-strong)]",
          )}
        >
          {action.kind === "step" && action.action === "concluir" ? <Check size={18} /> : <Play size={16} />}
          {pending ? "Registrando..." : action.label}
        </button>
      )}
      {targets.length > 0 ? <label className="flex items-center gap-2 text-xs text-[var(--muted)]">Mover para<select aria-label={`Mover OS ${visibleOrderNumber(order)} para`} value="" disabled={pending || boardPending} onChange={(event) => { if (event.target.value) onMove(order, event.target.value); }} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-[var(--ink)]"><option value="">Escolher status</option>{targets.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</select></label> : null}
      <Link href={`/montagem?os=${order.id}`} scroll={false} className="flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] text-xs font-semibold text-[var(--link)] hover:bg-[var(--background)]">Detalhes, fotos e histórico</Link>
      {error ? <Feedback error={error} /> : null}
      </div></div>
    </article>
  );
}
