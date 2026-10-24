"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QUEUE_STATUSES, STATUS_LABEL, type AppRole, type OrderStatus } from "@/lib/domain/constants";
import { canTransition } from "@/lib/domain/status";
import { dueDeltaLabel, type Urgency } from "@/lib/domain/urgency";
import type { OrderRow } from "@/lib/types";
import { changeOrderStatus } from "@/server/actions";
import { forecastOrder } from "@/lib/domain/forecast";
import { LensGauge } from "./lens";
import { STATUS_TONE } from "./status-badge";
import { Feedback } from "./ui";

const URGENCY: Record<Urgency, { label: string; fg: string; dot: string }> = {
  vermelho: { label: "Urgente", fg: "#a3261b", dot: "#d2382b" },
  amarelo: { label: "Atenção", fg: "#8a5a00", dot: "#d99a0b" },
  verde: { label: "No prazo", fg: "#44524f", dot: "#23955a" },
  cinza: { label: "Sem prazo", fg: "#8a9694", dot: "#c9d0d4" },
};

function deadlineStyle(order: OrderRow) {
  if (!order.due_at || order.status === "pronto") return { color: "#6e7c7a", fontWeight: 400 };
  if (new Date(order.due_at).getTime() < Date.now()) return { color: "#b42318", fontWeight: 600 };
  if (order.urgency === "amarelo") return { color: "#8a5a00", fontWeight: 600 };
  return { color: "#6e7c7a", fontWeight: 400 };
}

function Card({ order, href }: { order: OrderRow; href: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: order.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const urgency = URGENCY[order.urgency];
  const forecast = forecastOrder({ status: order.status, dueAt: order.due_at, stepsDone: order.steps_done });
  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-2 rounded-[10px] border border-[#e2e7e9] bg-white px-3 pb-2.5 pt-3 shadow-[0_1px_2px_rgba(19,32,31,0.04)] transition-shadow hover:border-[#cdd5d8] hover:shadow-[0_4px_12px_-6px_rgba(19,32,31,0.18)] ${isDragging ? "z-10 opacity-80 shadow-lg" : ""}`}
    >
      <div className="flex cursor-grab flex-col gap-2 active:cursor-grabbing" {...listeners} {...attributes}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-medium text-[#0e6b62]">{order.number}</span>
          <span className="flex items-center gap-[5px] text-[11px] font-semibold" style={{ color: urgency.fg }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: urgency.dot }} />
            {urgency.label}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold">{order.client_name}</span>
            <span className="truncate text-xs text-[#6e7c7a]">
              {order.store_name || order.laboratory_name} · {order.seller_name || "Sem vendedor"}
            </span>
          </div>
          <LensGauge value={forecast.progress} risk={forecast.risk} size={46} />
        </div>
        {order.status === "aguardando_lentes" ? (
          <div className="rounded-md bg-[#fdf3dc] px-2 py-[5px] text-xs font-medium text-[#8a5a00]">Aguardando lentes, montagem não iniciada</div>
        ) : null}
        {forecast.risk === "risco" ? (
          <div className="rounded-md bg-[#fdecea] px-2 py-[5px] text-xs font-semibold text-[#a3261b]" title={forecast.reason}>
            Risco de atraso · priorizar
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t border-[#eef1f3] pt-2 text-xs">
        <span className="flex items-center gap-[5px]" style={deadlineStyle(order)}>
          <Clock size={13} />
          {dueDeltaLabel(order.due_at, new Date(), order.status)}
        </span>
        <Link href={href} className="font-semibold text-[#0e6b62] hover:underline" onPointerDown={(event) => event.stopPropagation()}>
          Abrir
        </Link>
      </div>
    </article>
  );
}

function Column({ status, orders, hrefBase }: { status: OrderStatus; orders: OrderRow[]; hrefBase: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-60 w-[264px] shrink-0 flex-col gap-2 rounded-xl bg-[#e9edef] p-2.5 transition-shadow ${isOver ? "ring-2 ring-[#0e6b62]" : ""}`}
    >
      <div className="flex items-center gap-2 px-1 pb-1.5 pt-1">
        <span className="h-2 w-2 rounded-[2px]" style={{ background: STATUS_TONE[status].dot }} />
        <h2 className="flex-1 text-[13px] font-semibold">{status === "em_conferencia" ? "Em conferência" : STATUS_LABEL[status]}</h2>
        <span className="font-mono text-xs text-[#6e7c7a]">{orders.length}</span>
      </div>
      {orders.map((order) => (
        <Card key={order.id} order={order} href={`${hrefBase}/${order.id}`} />
      ))}
      {orders.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#cdd5d8] px-3 py-[18px] text-center text-xs text-[#8a9694]">Nenhuma OS</div>
      ) : null}
    </div>
  );
}

export function OrderKanban({
  orders,
  role,
  hrefBase,
}: {
  orders: OrderRow[];
  role: AppRole;
  hrefBase: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(event: DragEndEvent) {
    const order = orders.find((item) => item.id === event.active.id);
    const status = event.over?.id as OrderStatus | undefined;
    if (!order || !status || order.status === status) return;
    if (!canTransition(order.status, status, role)) {
      setError("Esta mudança de status não faz parte do fluxo ou do seu perfil.");
      return;
    }
    const result = await changeOrderStatus(order.id, status, "Movimentação pelo quadro");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <Feedback error={error} />
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex items-start gap-3.5 overflow-x-auto pb-2">
          {QUEUE_STATUSES.map((status) => (
            <Column key={status} status={status} hrefBase={hrefBase} orders={orders.filter((order) => order.status === status)} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
