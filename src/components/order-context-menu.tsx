"use client";
// Menu de ações rápidas da OS: botão direito do mouse (ou toque longo no celular).
// Usa só as ações que já existem no servidor: changeOrderStatus e confirmClientDelivery.
import { Check, ClipboardCopy, ExternalLink, MoveRight, PackageCheck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { can } from "@/lib/domain/permissions";
import { allowedTargets } from "@/lib/domain/status";
import { STATUS_LABEL, type AppRole, type OrderStatus } from "@/lib/domain/constants";
import { toDateTimeLocalValue } from "@/lib/format";
import { dateTimeLocalToIso } from "@/lib/domain/calendar";
import { changeOrderStatus } from "@/server/actions";
import { confirmClientDelivery } from "@/server/fast-operations-actions";
import { stageStyle } from "./production-visuals";

export type MenuOrder = { id: string; number: string; status: string; clientName: string; detailsHref: string };

/** Quem pode dar "Entregue ao cliente" (a regra do banco aceita só administrador e gestor). */
function canConfirmClient(role: AppRole, status: string) {
  return can(role, "orders.deliver") && ["admin", "gestor"].includes(role) && ["pronto", "entregue"].includes(status);
}

/** Liga o menu a qualquer elemento (inclusive linhas de tabela): espalhe "handlers" e renderize "element". */
export function useOrderMenu(order: MenuOrder, role: AppRole) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [deliver, setDeliver] = useState(false);
  const press = useRef<number | null>(null);
  function openAt(x: number, y: number) {
    setAt({ x: Math.max(8, Math.min(x, window.innerWidth - 268)), y: Math.max(8, Math.min(y, window.innerHeight - 368)) });
  }
  const stop = () => { if (press.current) window.clearTimeout(press.current); };
  const close = useCallback(() => setAt(null), []);
  const closeDeliver = useCallback(() => setDeliver(false), []);
  const handlers = {
    onContextMenu: (event: React.MouseEvent) => {
      // O menu normal do navegador continua em campos de texto.
      if ((event.target as HTMLElement).closest("input, textarea, select")) return;
      event.preventDefault();
      openAt(event.clientX, event.clientY);
    },
    onTouchStart: (event: React.TouchEvent) => {
      const touch = event.touches[0];
      press.current = window.setTimeout(() => openAt(touch.clientX, touch.clientY), 550);
    },
    onTouchMove: stop,
    onTouchEnd: stop,
  };
  const element = <>
    {at ? createPortal(<ActionsMenu order={order} role={role} at={at} onClose={close} onDeliver={() => { setAt(null); setDeliver(true); }} />, document.body) : null}
    {deliver ? createPortal(<DeliverDialog order={order} onClose={closeDeliver} />, document.body) : null}
  </>;
  return { handlers, element, open: (x: number, y: number) => openAt(x, y) };
}

export function OrderContextMenu({ order, role, children, className }: { order: MenuOrder; role: AppRole; children: ReactNode; className?: string }) {
  const menu = useOrderMenu(order, role);
  return <div className={className} {...menu.handlers}>{children}{menu.element}</div>;
}

function ActionsMenu({ order, role, at, onClose, onDeliver }: { order: MenuOrder; role: AppRole; at: { x: number; y: number }; onClose: () => void; onDeliver: () => void }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const targets = allowedTargets(order.status as OrderStatus, role).filter((status) => status !== "entregue" && status !== "em_correcao" && status !== "cancelado");
  const ready = targets.includes("pronto");
  const others = targets.filter((status) => status !== "pronto");

  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[role=menuitem]:not(:disabled)")?.focus();
    const outside = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) onClose(); };
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const items = [...(box.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not(:disabled)") ?? [])];
        const index = items.indexOf(document.activeElement as HTMLElement);
        items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    const close = () => onClose();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keys);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keys); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [onClose]);

  function move(to: OrderStatus) {
    start(async () => {
      try {
        const result = await changeOrderStatus(order.id, to, "Movimentação pelo menu rápido");
        if (!result.ok) toast.error(result.message ?? "Não foi possível mover a OS.");
        else toast.success(`OS ${order.number}: ${STATUS_LABEL[to]}`);
      } catch { toast.error("Não foi possível confirmar. Confira a conexão."); }
      finally { onClose(); router.refresh(); }
    });
  }

  return (
    <div ref={box} role="menu" aria-label={`Ações da OS ${order.number}`} className="ocm" style={{ left: at.x, top: at.y }} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
      <p className="ocm-head"><span className="font-mono">{order.number}</span> · {order.clientName}<span className="ocm-status" style={stageStyle(order.status as OrderStatus)}>{STATUS_LABEL[order.status as OrderStatus] ?? order.status}</span></p>
      <Link role="menuitem" href={order.detailsHref} scroll={false} onClick={onClose} className="ocm-item"><ExternalLink size={16} />Abrir a OS</Link>
      {ready ? <button type="button" role="menuitem" disabled={pending} onClick={() => move("pronto")} className="ocm-item is-main"><Check size={16} />Marcar como pronto</button> : null}
      {canConfirmClient(role, order.status) ? <button type="button" role="menuitem" disabled={pending} onClick={onDeliver} className="ocm-item is-main"><PackageCheck size={16} />Entregue ao cliente…</button> : null}
      {others.length ? <>
        <p className="ocm-title"><MoveRight size={13} />Mover para</p>
        {others.map((status) => <button key={status} type="button" role="menuitem" disabled={pending} onClick={() => move(status)} className="ocm-item"><span className="ocm-dot" style={stageStyle(status)} />{STATUS_LABEL[status]}</button>)}
      </> : null}
      {!ready && !others.length && !canConfirmClient(role, order.status) ? <p className="ocm-note">Nenhuma mudança de etapa disponível para o seu perfil agora.</p> : null}
      <hr className="ocm-sep" />
      <button type="button" role="menuitem" onClick={async () => { try { await navigator.clipboard.writeText(order.number); toast.success("Número da OS copiado."); } catch { toast.error("Não foi possível copiar."); } onClose(); }} className="ocm-item"><ClipboardCopy size={16} />Copiar nº da OS</button>
      {pending ? <p className="ocm-note">Salvando…</p> : null}
    </div>
  );
}

/** "Entregue ao cliente": mesma confirmação da tela da OS. Inicia o pós-venda de 5 dias. */
function DeliverDialog({ order, onClose }: { order: MenuOrder; onClose: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(() => toDateTimeLocalValue(new Date().toISOString()));
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="ocm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`entregar-${order.id}`}
        className="ocm-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          let delivered: string;
          try { delivered = dateTimeLocalToIso(date); } catch { setError("Confira a data e a hora da entrega."); return; }
          start(async () => {
            setError(null);
            try {
              const result = await confirmClientDelivery(order.id, phone, delivered);
              if (!result.ok) { setError(result.message); return; }
              toast.success(`OS ${order.number}: entregue ao cliente. Pós-venda em 5 dias.`);
              onClose();
              router.refresh();
            } catch { setError("Não foi possível confirmar. Confira a conexão."); }
          });
        }}
      >
        <div className="flex items-start gap-3">
          <span className="ocm-dialog-icon"><PackageCheck size={20} /></span>
          <div className="min-w-0 flex-1">
            <h2 id={`entregar-${order.id}`} className="text-lg font-semibold">Entregue ao cliente</h2>
            <p className="text-sm text-[var(--muted)]"><span className="font-mono">{order.number}</span> · {order.clientName}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-secondary)]"><X size={18} /></button>
        </div>
        <p className="rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--sidebar-active-text,var(--link))]">O pós-venda aparece em <strong>5 dias</strong> para saber se o cliente se adaptou bem aos óculos.</p>
        <label className="grid gap-1 text-sm font-medium">Quando o cliente recebeu<input type="datetime-local" required value={date} max={toDateTimeLocalValue(new Date().toISOString())} onChange={(event) => setDate(event.target.value)} className="ocm-input" /></label>
        <label className="grid gap-1 text-sm font-medium">WhatsApp do cliente <span className="font-normal text-[var(--muted)]">(opcional, com DDD)</span><input type="tel" inputMode="tel" value={phone} maxLength={24} onChange={(event) => setPhone(event.target.value)} placeholder="(12) 99999-9999" className="ocm-input" /></label>
        {error ? <p role="alert" className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ocm-btn">Cancelar</button>
          <button type="submit" disabled={pending} className="ocm-btn is-primary">{pending ? "Confirmando…" : "Confirmar entrega"}</button>
        </div>
      </form>
    </div>
  );
}

/** Linha de tabela com o menu rápido (botão direito). */
export function OrderMenuRow({ order, role, className, children }: { order: MenuOrder; role: AppRole; className?: string; children: ReactNode }) {
  const menu = useOrderMenu(order, role);
  return <tr className={className} {...menu.handlers}>{children}{menu.element}</tr>;
}
