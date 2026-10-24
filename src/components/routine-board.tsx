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
    <section className="rounded-xl border border-[#e2e7e9] bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-[#eef1f3] px-4 py-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Icon size={17} className="text-[#c8881a]" /> {title}
        </h2>
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", count === items.length ? "bg-[#e6f4ec] text-[#1c6b43]" : "bg-[#eef1f3] text-[#44524f]")}>
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
                className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors", log ? "bg-[#f0f7f3]" : "hover:bg-[#f7f9f9]")}
              >
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors", log ? "border-[#1c6b43] bg-[#1c6b43] text-white" : "border-[#cdd5d8] bg-white")}>
                  {log ? <Check size={14} strokeWidth={3} /> : null}
                </span>
                <span className={cn("flex-1 text-sm", log ? "text-[#44524f] line-through decoration-[#9fb3b0]" : "font-medium")}>{item.label}</span>
                {log ? <span className="text-[11px] text-[#6e7c7a]">{time.format(new Date(log.done_at))}</span> : null}
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
        <div className="flex items-center gap-3 rounded-xl border border-[#e2e7e9] bg-white p-4">
          <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#eef1f3" strokeWidth="4" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="#1c6b43" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${progress * 94.2} 94.2`} className="transition-[stroke-dasharray] duration-500" />
          </svg>
          <div>
            <p className="text-[13px] font-medium text-[#6e7c7a]">Rotina do dia</p>
            <p className="tabular text-2xl font-semibold">{Math.round(progress * 100)}%</p>
          </div>
        </div>
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="rounded-xl border border-[#e2e7e9] bg-white p-4 transition-shadow hover:shadow-[0_8px_24px_-16px_rgba(19,32,31,0.35)]">
            <p className="text-[13px] font-medium text-[#6e7c7a]">{stat.label}</p>
            <p className="tabular mt-1 text-2xl font-semibold">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Checklist title="Abertura" icon={Sun} items={ROUTINE_OPEN} done={done} canEdit={canEdit} onToggle={onToggle} />

        <section className="rounded-xl border border-[#e2e7e9] bg-white">
          <header className="flex items-center justify-between gap-2 border-b border-[#eef1f3] px-4 py-3">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <Bike size={17} className="text-[#1e4d9b]" /> Durante o dia
            </h2>
            <span className="text-xs text-[#6e7c7a]">{lensesToday} lentes recebidas</span>
          </header>
          {canEdit ? (
            <div className="grid gap-2 border-b border-[#eef1f3] p-4">
              <p className="text-[13px] font-semibold">Chegou o motoboy?</p>
              <div className="flex gap-2">
                <Input value={lenses} onChange={(event) => setLenses(event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="Qtd. de lentes" className="w-32" />
                <Input value={motoNote} onChange={(event) => setMotoNote(event.target.value)} placeholder="De qual laboratório? (opcional)" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={arrival} disabled={saving}>
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
            {timeline.length === 0 ? <li className="px-3 py-6 text-center text-xs text-[#8a9694]">Nenhuma chegada registrada hoje.</li> : null}
            {timeline.map((log) => (
              <li key={log.id} className="group flex items-start gap-3 rounded-lg px-2.5 py-2 hover:bg-[#f7f9f9]">
                <span className="tabular mt-0.5 w-11 shrink-0 text-xs font-semibold text-[#6e7c7a]">{time.format(new Date(log.done_at))}</span>
                <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", log.kind === "motoboy" ? "bg-[#1e4d9b]" : "bg-[#c8881a]")} />
                <span className="flex-1 text-sm">
                  <span className="font-medium">{log.label}</span>
                  {log.lenses_count != null ? <span className="text-[#6e7c7a]"> · {log.lenses_count} lentes</span> : null}
                  {log.notes ? <span className="block text-xs text-[#6e7c7a]">{log.notes}</span> : null}
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    aria-label="Remover"
                    className="rounded p-1 text-[#8a9694] opacity-0 hover:text-[#b42318] group-hover:opacity-100"
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
