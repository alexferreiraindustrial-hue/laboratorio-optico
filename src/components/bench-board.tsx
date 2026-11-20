"use client";

import { Check, ChevronDown, ChevronRight, GripVertical, LayoutList, Play, ScanLine, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { useOperationMode } from "./operation-mode";
import { RiskChip } from "@/components/forecast-ui";
import { LensGauge } from "@/components/lens";
import { Feedback } from "@/components/ui";
import { DndContext, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { BENCH_LANES, benchForecast, nextBenchAction, selectBenchOrders, type BenchOrder, type BenchFocus, type BenchSort } from "@/lib/domain/bench";
export type { BenchOrder } from "@/lib/domain/bench";
import { STEP_KEYS, STEP_LABEL, STEP_STATUS_LABEL, STATUS_LABEL, type AppRole, type StepKey } from "@/lib/domain/constants";
import { formatHoursShort } from "@/lib/domain/forecast";
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
  const [focus, setFocus] = useState<BenchFocus>("all");
  const [sort, setSort] = useState<BenchSort>("risk");
  const [assigneeId, setAssigneeId] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [pending, startMove] = useTransition();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const visible = selectBenchOrders(orders, { query, focus: simple && !["all", "risk", "mine"].includes(focus) ? "all" : focus, assigneeId: simple ? "" : assigneeId, sort: simple ? "risk" : sort, userId }, now);
  const people = Array.from(new Map(orders.flatMap((order) => order.steps.filter((step) => step.status === "em_andamento" && step.assigneeId).map((step) => [step.assigneeId!, step.assignee || "Responsável"] as const))).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const lateCount = orders.filter((order) => ["atrasada", "risco", "atencao"].includes(benchForecast(order, now).risk)).length;
  const runningCount = orders.filter((order) => order.steps.some((step) => step.status === "em_andamento")).length;
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));

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
    if (lane) setActiveLane(lane.status);
    if (status === "pronto") setNotice("Serviço conferido e pronto. Agora ele aparece em Retirada e entrega.");
  }

  function onDragEnd(event: DragEndEvent) {
    const order = orders.find((item) => item.id === event.active.id);
    if (order && event.over) moveOrder(order, String(event.over.id));
  }

  return <div className="grid min-w-0 gap-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#8c6239]">Produção · montagem</p><h1 className="text-[26px] font-semibold tracking-tight">Bancada de montagem</h1><p className="mt-1 max-w-2xl text-sm text-[#6e6a63]">Priorize o prazo, acompanhe cada etapa e registre a próxima ação sem sair do quadro.</p></div>
      <Link href="/montagem?view=lista" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#e2ddd5] bg-white px-3 text-sm font-semibold"><LayoutList size={16} />Ver em lista</Link>
    </header>
    {!simple ? <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Resumo da bancada">
      {[["Na bancada", orders.length, "Serviços carregados"], ["Atenção aos prazos", lateCount, "Atraso ou folga curta"], ["Etapa em execução", runningCount, "Responsável registrado"], ["Em correção", orders.filter((order) => order.status === "em_correcao").length, "Acompanhar retrabalho"]].map(([label, value, hint]) => <div key={label} className="rounded-xl border border-[#e2ddd5] bg-white p-3"><p className="text-xs font-medium text-[#6e6a63]">{label}</p><p className="my-1 font-mono text-2xl font-semibold text-[#222222]">{value}</p><p className="hidden text-xs text-[#6e6a63] sm:block">{hint}</p></div>)}
    </div> : null}
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#e2ddd5] bg-white p-3">
      <label className="min-w-48 flex-1 text-xs font-medium text-[#6e6a63]">Buscar na bancada<div className="mt-1 flex items-center gap-2 rounded-lg border border-[#e2ddd5] px-3 focus-within:ring-2 focus-within:ring-[#8c6239]/20"><ScanLine size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bipe ou digite OS, cliente, vendedor" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div></label>
      {!simple ? <><label className="text-xs font-medium text-[#6e6a63]">Responsável pela etapa<select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="mt-1 block min-h-11 max-w-56 rounded-lg border border-[#e2ddd5] bg-white px-2 text-sm"><option value="">Todos os responsáveis</option>{people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="text-xs font-medium text-[#6e6a63]">Ordenação<select value={sort} onChange={(event) => setSort(event.target.value as BenchSort)} className="mt-1 block min-h-11 rounded-lg border border-[#e2ddd5] bg-white px-2 text-sm"><option value="risk">Maior risco primeiro</option><option value="deadline">Prazo mais próximo</option><option value="oldest">Entrada mais antiga</option></select></label></> : null}
    </div>
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Foco da bancada">
      {([["all", "Todas"], ["risk", "Atenção aos prazos"], ["mine", "Minhas etapas em execução"], ["unassigned", "Sem responsável em execução"], ["critical", "Prioridade crítica"]] as const).filter(([value]) => !simple || ["all", "risk", "mine"].includes(value)).map(([value, label]) => <button key={value} type="button" onClick={() => setFocus(value)} aria-pressed={focus === value} className={cn("min-h-11 rounded-lg border px-3 text-xs font-semibold", focus === value ? "border-[#8c6239] bg-[#f3ece2] text-[#8c6239]" : "border-[#e2ddd5] bg-white text-[#6e6a63]")}>{label}</button>)}
      <span role="status" className="ml-auto text-xs text-[#6e6a63]">{visible.length} de {orders.length} OS{pending ? " · Salvando…" : ""}</span>
      {query || focus !== "all" || assigneeId ? <button type="button" onClick={() => { setQuery(""); setFocus("all"); setAssigneeId(""); }} className="min-h-11 px-2 text-xs font-semibold text-[#8c6239]">Limpar filtros</button> : null}
    </div>
    {simple ? <><p className="rounded-lg bg-[#f3ece2] p-3 text-sm text-[#6e4b2a]">1. Escolha a fila abaixo. 2. Encontre a OS. 3. Aperte o botão indicado no cartão.</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Escolher fila de montagem">{BENCH_LANES.map((lane) => <button key={lane.status} type="button" onClick={() => setActiveLane(lane.status)} aria-pressed={activeLane === lane.status} className={cn("min-h-14 rounded-xl border px-3 py-2 text-left text-sm font-semibold", activeLane === lane.status ? "border-[#8c6239] bg-[#8c6239] text-white" : "border-[#e2ddd5] bg-white text-[#6e6a63]")}>{lane.title}<span className="ml-2 font-mono">{visible.filter((order) => order.status === lane.status).length}</span></button>)}</div></> : <p className="text-xs text-[#6e6a63]">Arraste pela alça ou use “Mover para”. A próxima ação registra cada etapa; mover a OS não conclui etapas. Filtros aplicados às até 200 OS carregadas.</p>}
    {notice ? <div role="status" className="rounded-xl border border-[#b5ddd0] bg-[#f3ece2] p-4 text-sm text-[#6e4b2a]">{notice}<Link href="/entrega" className="mt-2 block min-h-11 py-2 font-semibold underline">Ver serviços para retirada</Link></div> : null}
    <Feedback error={moveError || error} />
    <DndContext id={boardId} sensors={sensors} onDragEnd={onDragEnd}>
      <div className="-mx-3 flex min-w-0 snap-x snap-mandatory items-start gap-3 overflow-x-auto px-3 pb-4 md:mx-0 md:px-0 md:snap-none" aria-label="Kanban da bancada">
        {BENCH_LANES.filter((lane) => !simple || lane.status === activeLane).map((lane) => <BenchLane simple={simple} key={lane.status} lane={lane} orders={visible.filter((order) => order.status === lane.status)} total={orders.filter((order) => order.status === lane.status).length} collapsed={collapsed.includes(lane.status)} onToggle={() => setCollapsed((current) => current.includes(lane.status) ? current.filter((status) => status !== lane.status) : [...current, lane.status])} role={role} now={now} pending={pending} onMove={moveOrder} onProgress={followStatus} />)}
      </div>
    </DndContext>
  </div>;
}

function BenchLane({ simple, lane, orders, total, collapsed, onToggle, role, now, pending, onMove, onProgress }: { simple: boolean; lane: typeof BENCH_LANES[number]; orders: BenchOrder[]; total: number; collapsed: boolean; onToggle: () => void; role: AppRole; now: Date; pending: boolean; onMove: (order: BenchOrder, status: string) => void; onProgress: (status: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.status });
  return <section ref={setNodeRef} className={cn("flex min-h-52 w-[min(88vw,340px)] shrink-0 snap-start flex-col gap-3 rounded-xl bg-[#e8eeee] p-2.5 md:w-[328px]", simple && "!w-full", isOver && "ring-2 ring-[#8c6239]")}>
    <header className="flex items-start gap-2 px-1"><span className="mt-4 h-2 w-2 shrink-0 rounded-sm" style={{ background: lane.color }} /><div className="min-w-0 flex-1"><h2><button type="button" onClick={onToggle} aria-expanded={!collapsed} className="flex min-h-11 w-full items-center gap-1 text-left text-sm font-semibold">{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{lane.title}</button></h2><p className="text-xs text-[#6e6a63]">{lane.hint}</p></div><span className="mt-3 font-mono text-xs text-[#6e6a63]" title={`${orders.length} visíveis de ${total}`}>{orders.length === total ? total : `${orders.length}/${total}`}</span></header>
    {!collapsed && (orders.length ? <div className={cn("grid gap-3", simple && "md:grid-cols-2 xl:grid-cols-3")}>{orders.map((order) => <BenchCard key={order.id} order={order} role={role} now={now} boardPending={pending} onMove={onMove} onProgress={onProgress} />)}</div> : <p className="rounded-lg border border-dashed border-[#c5d1d2] px-3 py-8 text-center text-xs text-[#6e6a63]">{total ? "Nenhuma OS corresponde aos filtros." : "Nenhuma OS nesta etapa."}</p>)}
  </section>;
}

function BenchCard({ order, role, now, boardPending, onMove, onProgress }: { order: BenchOrder; role: AppRole; now: Date; boardPending: boolean; onMove: (order: BenchOrder, status: string) => void; onProgress: (status: string) => void }) {
  const router = useRouter();
  const { simple } = useOperationMode();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const stepsDone = order.steps.filter((step) => step.status === "concluida").length;
  const forecast = benchForecast(order, now);
  const action = nextBenchAction(order, role);
  const targets = allowedTargets(order.status, role).filter((status) => BENCH_LANES.some((lane) => lane.status === status));
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: order.id, disabled: simple || pending || boardPending || targets.length === 0 });
  const running = order.steps.find((step) => step.status === "em_andamento");
  const late = forecast.risk === "atrasada" || forecast.risk === "risco";

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
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "grid gap-3 rounded-xl border bg-white p-3.5 shadow-[0_1px_0_rgba(19,32,31,0.04)]",
        isDragging && "z-20 opacity-80 shadow-lg",
        late ? "border-[#f1c4be]" : "border-[#dfe6e7]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/montagem?os=${order.id}`} scroll={false} className="font-mono text-[13px] font-semibold text-[#8c6239] hover:underline">
              {visibleOrderNumber(order)}
            </Link>
            {order.urgent ? <span className="rounded-md bg-[#f9eaea] px-1.5 py-px text-[11px] font-bold text-[#b83a3a]">Urgente</span> : null}
            {order.status === "em_correcao" ? (
              <span className="rounded-md bg-[#f9eaea] px-1.5 py-px text-[11px] font-bold text-[#b83a3a]">Em correção</span>
            ) : null}
          </div>
          <p className="mt-0.5 break-words text-[17px] font-semibold leading-snug">{order.clientName}</p>
          <p className="break-words text-xs font-semibold text-[#6e4b2a]">{order.laboratoryName || "Sem laboratório"}</p>
          <p className="break-words text-xs text-[#6e6a63]">{[order.storeName, order.sellerName].filter(Boolean).join(" · ") || "Sem loja ou vendedor"}</p>
          <p className={cn("mt-1 text-xs font-semibold", late ? "text-[#b83a3a]" : "text-[#222222]")}>
            {order.dueAt ? `Prazo ${formatDateTime(order.dueAt)}` : "Sem previsão de entrega"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {!simple && targets.length ? <button type="button" aria-label={`Arrastar OS ${visibleOrderNumber(order)}`} className="flex h-11 w-11 touch-none items-center justify-center rounded-lg text-[#6e6a63] hover:bg-[#f3ece2] cursor-grab" {...listeners} {...attributes}><GripVertical size={17} /></button> : null}
          <LensGauge value={forecast.progress} risk={forecast.risk} size={50} />
        </div>
      </div>

      {order.openOccurrences ? <Link href={`/montagem?os=${order.id}`} scroll={false} className="rounded-lg bg-[#f9eaea] px-2.5 py-2 text-xs font-semibold text-[#b83a3a]">{order.openOccurrences} ocorrência(s) de qualidade aberta(s) · verificar</Link> : null}
      <details open={!simple} className="rounded-lg bg-[#f7f6f3] p-2.5">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm"><span className="font-semibold">Ver etapas da montagem</span><span className="font-mono text-[#6e6a63]">{stepsDone}/5</span></summary>
        <ol className="grid gap-1.5" aria-label="Etapas da montagem">
          {STEP_KEYS.map((key) => {
            const step = order.steps.find((item) => item.key === key);
            const status = step?.status ?? "pendente";
            return <li key={key} className="flex items-start gap-2 text-xs" title={step?.assignee || undefined}>
              <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border", status === "concluida" ? "border-[#8c6239] bg-[#8c6239] text-white" : status === "em_andamento" ? "border-[#8c6239] text-[#8c6239]" : status === "reprovada" ? "border-[#b83a3a] text-[#b83a3a]" : "border-[#e2ddd5] text-[#6e6a63]")}>{status === "concluida" ? <Check size={11} /> : status === "em_andamento" ? <Play size={9} /> : status === "reprovada" ? "!" : null}</span>
              <span className="min-w-0 flex-1">{SHORT[key]}</span><span className={cn("text-right text-[11px]", status === "em_andamento" ? "font-semibold text-[#8c6239]" : "text-[#6e6a63]")}>{step ? STEP_STATUS_LABEL[status] : "Não cadastrada"}</span>
            </li>;
          })}
        </ol>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6e6a63]">
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
        <p className="rounded-lg bg-[#f3ece2] px-3 py-2.5 text-center text-sm font-medium text-[#6e6a63]">{action.label}</p>
      ) : (
        <button
          type="button"
          onClick={run}
          disabled={pending || boardPending}
          className={cn(
            "flex min-h-12 w-full px-2 py-2 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#8c6239]/30 disabled:opacity-60",
            action.kind === "status" && action.to === "pronto"
              ? "bg-[#2e7d5b] hover:bg-[#18723f]"
              : action.kind === "step" && action.action === "concluir"
                ? "bg-[#734f2d] hover:bg-[#08463f]"
                : "bg-[#8c6239] hover:bg-[#734f2d]",
          )}
        >
          {action.kind === "step" && action.action === "concluir" ? <Check size={18} /> : <Play size={16} />}
          {pending ? "Registrando..." : action.label}
        </button>
      )}
      {!simple && targets.length > 0 ? <label className="flex items-center gap-2 text-xs text-[#6e6a63]">Mover para<select aria-label={`Mover OS ${visibleOrderNumber(order)} para`} value="" disabled={pending || boardPending} onChange={(event) => { if (event.target.value) onMove(order, event.target.value); }} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#e2ddd5] bg-white px-2 text-[#222222]"><option value="">Escolher status</option>{targets.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</select></label> : null}
      <Link href={`/montagem?os=${order.id}`} scroll={false} className="flex min-h-11 items-center justify-center rounded-lg border border-[#e2ddd5] text-xs font-semibold text-[#8c6239] hover:bg-[#f7f6f3]">Detalhes, fotos e histórico</Link>
      {error ? <Feedback error={error} /> : null}
    </article>
  );
}
