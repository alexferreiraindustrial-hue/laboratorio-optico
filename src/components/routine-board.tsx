"use client";

import { Bike, Check, Moon, ScanLine, StickyNote, Sun, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { ROUTINE_CLOSE, ROUTINE_OPEN } from "@/lib/domain/flow";
import { cn } from "@/lib/utils";
import { addRoutineNote, logMotoboy, removeRoutineLog, toggleRoutineItem } from "@/server/flow-actions";
import type { RoutineLog } from "@/server/flow";
import { Button, Input } from "./ui";

const time = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

function Checklist({
  title,
  icon: Icon,
  items,
  done,
  canEdit,
  onToggle,
}: {
  title: string;
  icon: typeof Sun;
  items: readonly { key: string; label: string }[];
  done: Map<string, RoutineLog>;
  canEdit: boolean;
  onToggle: (key: string, label: string, value: boolean) => void;
}) {
  const count = items.filter((item) => done.has(item.key)).length;
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Icon size={17} className="text-[var(--warning)]" /> {title}
        </h2>
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", count === items.length ? "bg-[var(--ok-soft)] text-[var(--ok)]" : "bg-[var(--surface-secondary)] text-[var(--muted)]")}>
          {count}/{items.length}
        </span>
      </header>
      <ul className="grid gap-1 p-2">
        {items.map((item) => {
          const log = done.get(item.key);
          return (
            <li key={item.key}>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => onToggle(item.key, item.label, !log)}
                className={cn("flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors", log ? "bg-[var(--bg-f0f7f3)]" : "hover:bg-[var(--background)]")}
              >
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors", log ? "border-[var(--edge-2e7d5b)] bg-[var(--bg-2e7d5b)] text-white" : "border-[var(--line)] bg-[var(--surface)]")}>
                  {log ? <Check size={14} strokeWidth={3} /> : null}
                </span>
                <span className={cn("flex-1 text-sm", log ? "text-[var(--muted)] line-through decoration-[#9fb3b0]" : "font-medium")}>{item.label}</span>
                {log ? <span className="text-[11px] text-[var(--muted)]">{time.format(new Date(log.done_at))}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function RoutineBoard({ logs, canEdit, stats }: { logs: RoutineLog[]; canEdit: boolean; stats: { label: string; value: number; href: string }[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [optimistic, toggle] = useOptimistic(logs, (state, change: { key: string; label: string; value: boolean }) =>
    change.value
      ? [...state, { id: `tmp-${change.key}`, kind: "checklist" as const, item_key: change.key, label: change.label, lenses_count: null, notes: null, done_at: new Date().toISOString(), done_by: null }]
      : state.filter((log) => !(log.kind === "checklist" && log.item_key === change.key)),
  );
  const [lenses, setLenses] = useState("");
  const [motoNote, setMotoNote] = useState("");
  const [note, setNote] = useState("");
  const [saving, startSave] = useTransition();

  const done = new Map(optimistic.filter((log) => log.kind === "checklist" && log.item_key).map((log) => [log.item_key!, log]));
  const timeline = optimistic.filter((log) => log.kind !== "checklist").sort((a, b) => b.done_at.localeCompare(a.done_at));
  const total = ROUTINE_OPEN.length + ROUTINE_CLOSE.length;
  const progress = [...ROUTINE_OPEN, ...ROUTINE_CLOSE].filter((item) => done.has(item.key)).length / total;
  const lensesToday = timeline.filter((log) => log.kind === "motoboy").reduce((sum, log) => sum + (log.lenses_count ?? 0), 0);

  function onToggle(key: string, label: string, value: boolean) {
    start(async () => {
      toggle({ key, label, value });
      const result = await toggleRoutineItem(key, label, value);
      if (!result.ok) toast.error(result.message);
      router.refresh();
    });
  }

  function arrival() {
    startSave(async () => {
      const result = await logMotoboy(lenses ? Number(lenses) : null, motoNote);
      if (result.ok) {
        toast.success(result.message, { action: { label: "Bipar lentes", onClick: () => router.push("/laboratorio/rapido?modo=lentes") } });
        setLenses("");
        setMotoNote("");
        router.refresh();
      } else toast.error(result.message);
    });
  }

  function saveNote() {
    startSave(async () => {
      const result = await addRoutineNote(note);
      if (result.ok) {
        setNote("");
        router.refresh();
      } else toast.error(result.message);
    });
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#efece6" strokeWidth="4" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="#2e7d5b" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${progress * 94.2} 94.2`} className="transition-[stroke-dasharray] duration-500" />
          </svg>
          <div>
            <p className="text-[13px] font-medium text-[var(--muted)]">Rotina do dia</p>
            <p className="tabular text-2xl font-semibold">{Math.round(progress * 100)}%</p>
          </div>
        </div>
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-shadow hover:shadow-[0_8px_24px_-16px_rgba(19,32,31,0.35)]">
            <p className="text-[13px] font-medium text-[var(--muted)]">{stat.label}</p>
            <p className="tabular mt-1 text-2xl font-semibold">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Checklist title="Abertura" icon={Sun} items={ROUTINE_OPEN} done={done} canEdit={canEdit} onToggle={onToggle} />

        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          <header className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <Bike size={17} className="text-[var(--link)]" /> Durante o dia
            </h2>
            <span className="text-xs text-[var(--muted)]">{lensesToday} lentes recebidas</span>
          </header>
          {canEdit ? (
            <div className="grid gap-2 border-b border-[var(--line)] p-4">
              <p className="text-[13px] font-semibold">Chegou o motoboy?</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={lenses} onChange={(event) => setLenses(event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="Qtd. de lentes" className="sm:w-32" />
                <Input value={motoNote} onChange={(event) => setMotoNote(event.target.value)} placeholder="De qual laboratório? (opcional)" />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button onClick={arrival} disabled={saving} className="w-full sm:w-auto">
                  <Bike size={16} /> Registrar chegada
                </Button>
                <Button variant="secondary" asChild>
                  <Link href="/laboratorio/rapido?modo=lentes">
                    <ScanLine size={16} /> Bipar lentes
                  </Link>
                </Button>
              </div>
              <div className="mt-2 flex gap-2">
                <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Anotação rápida do dia" onKeyDown={(event) => event.key === "Enter" && note.trim() && saveNote()} />
                <Button variant="secondary" onClick={saveNote} disabled={saving || !note.trim()}>
                  <StickyNote size={15} />
                </Button>
              </div>
            </div>
          ) : null}
          <ol className="grid gap-0 p-2">
            {timeline.length === 0 ? <li className="px-3 py-6 text-center text-xs text-[var(--muted)]">Nenhuma chegada registrada hoje.</li> : null}
            {timeline.map((log) => (
              <li key={log.id} className="group flex items-start gap-3 rounded-lg px-2.5 py-2 hover:bg-[var(--background)]">
                <span className="tabular mt-0.5 w-11 shrink-0 text-xs font-semibold text-[var(--muted)]">{time.format(new Date(log.done_at))}</span>
                <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", log.kind === "motoboy" ? "bg-[var(--bg-6e4b2a)]" : "bg-[var(--bg-87601f)]")} />
                <span className="flex-1 text-sm">
                  <span className="font-medium">{log.label}</span>
                  {log.lenses_count != null ? <span className="text-[var(--muted)]"> · {log.lenses_count} lentes</span> : null}
                  {log.notes ? <span className="block text-xs text-[var(--muted)]">{log.notes}</span> : null}
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    aria-label="Remover"
                    className="grid h-11 w-11 place-items-center rounded-lg text-[var(--muted)] hover:text-[var(--danger)] sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={() =>
                      start(async () => {
                        const result = await removeRoutineLog(log.id);
                        if (!result.ok) toast.error(result.message);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <Checklist title="Fechamento" icon={Moon} items={ROUTINE_CLOSE} done={done} canEdit={canEdit} onToggle={onToggle} />
      </div>
    </div>
  );
}
