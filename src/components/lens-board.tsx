"use client";

import { PackageOpen, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { LENS_RISK, lensRisk, type LensRisk } from "@/lib/domain/flow";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { cn } from "@/lib/utils";
import { updateLensForecast } from "@/server/flow-actions";
import type { LensQueueRow } from "@/server/flow";
import { quickMoveOrders } from "@/server/quick-actions";
import { Button } from "./ui";

const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" });
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

function slackText(hours: number | null) {
  if (hours == null) return "";
  const abs = Math.abs(hours);
  const text = abs < 48 ? `${Math.round(abs)} h` : `${Math.round(abs / 24)} dias`;
  return hours >= 0 ? `folga de ${text}` : `faltam ${text}`;
}

function Row({ row, now, selected, onToggle, canEdit }: { row: LensQueueRow; now: Date; selected: boolean; onToggle: () => void; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(row.lens_expected_at ? ymd.format(new Date(row.lens_expected_at)) : "");
  const [ref, setRef] = useState(row.lens_supplier_ref ?? "");
  const risk = lensRisk({ dueAt: row.due_at, lensExpectedAt: row.lens_expected_at, now });
  const tone = LENS_RISK[risk.risk];

  function save(nextDate: string, nextRef: string) {
    if (nextDate === (row.lens_expected_at ? ymd.format(new Date(row.lens_expected_at)) : "") && nextRef === (row.lens_supplier_ref ?? "")) return;
    start(async () => {
      const result = await updateLensForecast(row.id, nextDate || null, nextRef || null);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.message);
    });
  }

  return (
    <tr className={cn("border-t border-[#eef1f3] transition-colors", selected ? "bg-[#f0f7f6]" : "hover:bg-[#fafbfb]", pending && "opacity-60")}>
      <td className="py-2.5 pl-4 pr-1">
        <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 accent-[#0e6b62]" aria-label={`Selecionar ${row.number}`} />
      </td>
      <td className="px-3 py-2.5">
        <Link href={`/laboratorio/${row.id}`} className="font-mono text-xs font-semibold text-[#0e6b62] hover:underline">
          {visibleOrderNumber(row)}
        </Link>
        <p className="max-w-[220px] truncate text-sm font-semibold">{row.client_name}</p>
        <p className="max-w-[220px] truncate text-xs text-[#6e7c7a]">{[row.seller_name, row.store_name].filter(Boolean).join(" · ") || "Sem vendedor"}</p>
      </td>
      <td className="px-3 py-2.5 text-sm">
        {row.due_at ? fmt.format(new Date(row.due_at)) : <span className="text-[#8a9694]">sem prazo</span>}
        {risk.latestArrival ? <p className="text-[11px] text-[#6e7c7a]">lente até {fmt.format(risk.latestArrival)}</p> : null}
      </td>
      <td className="px-3 py-2.5">
        {canEdit ? (
          <div className="flex flex-col gap-1">
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                save(event.target.value, ref);
              }}
              className="h-8 w-[140px] rounded-md border border-[#cdd5d8] px-2 text-[13px] outline-none focus:border-[#0e6b62]"
              aria-label="Previsão do laboratório"
            />
            <input
              value={ref}
              onChange={(event) => setRef(event.target.value.slice(0, 60))}
              onBlur={() => save(date, ref)}
              placeholder="nº do pedido"
              className="h-7 w-[140px] rounded-md border border-transparent bg-[#f7f9f9] px-2 text-xs outline-none focus:border-[#0e6b62]"
            />
          </div>
        ) : (
          <span className="text-sm">{row.lens_expected_at ? fmt.format(new Date(row.lens_expected_at)) : "—"}</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold" style={{ color: tone.fg, background: tone.bg }}>
          {tone.label}
        </span>
        <p className="mt-0.5 text-[11px] text-[#6e7c7a]">{risk.risk === "ok" || risk.risk === "apertado" || risk.risk === "vai_atrasar" ? slackText(risk.slackHours) : ""}</p>
      </td>
      <td className="px-3 py-2.5 text-xs text-[#6e7c7a]">{fmt.format(new Date(row.entered_at))}</td>
    </tr>
  );
}

export function LensBoard({ rows, canEdit, canRelease, nowIso }: { rows: LensQueueRow[]; canEdit: boolean; canRelease: boolean; nowIso: string }) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [filter, setFilter] = useState<LensRisk | "todas">("todas");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const withRisk = useMemo(
    () =>
      rows
        .map((row) => ({ row, risk: lensRisk({ dueAt: row.due_at, lensExpectedAt: row.lens_expected_at, now }).risk }))
        .sort((a, b) => LENS_RISK[a.risk].rank - LENS_RISK[b.risk].rank || (a.row.due_at ?? "9").localeCompare(b.row.due_at ?? "9")),
    [rows, now],
  );
  const counts = withRisk.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.risk]: (acc[item.risk] ?? 0) + 1 }), {});
  const text = query.trim().toLowerCase();
  const visible = withRisk.filter(
    (item) =>
      (filter === "todas" || item.risk === filter) &&
      (!text || `${item.row.number} ${item.row.external_order_id ?? ""} ${item.row.client_name} ${item.row.seller_name ?? ""} ${item.row.store_name ?? ""} ${item.row.lens_supplier_ref ?? ""}`.toLowerCase().includes(text)),
  );

  function release() {
    const ids = [...selected];
    start(async () => {
      const result = await quickMoveOrders(ids, "aguardando_montagem", "Lentes recebidas");
      if (result.ok) {
        toast.success(`${result.message} Liberadas para a bancada.`);
        setSelected(new Set());
        router.refresh();
      } else toast.error(result.message);
    });
  }

  const chips: (LensRisk | "todas")[] = ["todas", "lente_atrasada", "vai_atrasar", "apertado", "sem_previsao", "ok", "sem_prazo"];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((key) => {
          const count = key === "todas" ? rows.length : counts[key] ?? 0;
          if (key !== "todas" && count === 0) return null;
          const tone = key === "todas" ? null : LENS_RISK[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-semibold transition-colors",
                filter === key ? "border-[#13201f] bg-[#13201f] text-white" : "border-[#e2e7e9] bg-white text-[#44524f] hover:border-[#cdd5d8]",
              )}
            >
              {tone ? <span className="h-2 w-2 rounded-full" style={{ background: tone.bg === "#b42318" ? "#b42318" : tone.fg }} /> : null}
              {key === "todas" ? "Todas" : tone!.label}
              <span className="font-mono text-xs opacity-80">{count}</span>
            </button>
          );
        })}
        <label className="ml-auto flex h-8 items-center gap-2 rounded-lg border border-[#e2e7e9] bg-white px-2.5 text-[#6e7c7a]">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="OS, cliente, pedido" className="w-40 bg-transparent text-sm text-[#13201f] outline-none" />
        </label>
      </div>

      {selected.size > 0 && canRelease ? (
        <div className="sticky top-[68px] z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#0e6b62] bg-[#e4f1ef] px-4 py-2.5 shadow-sm">
          <span className="text-sm font-semibold text-[#0a4f48]">{selected.size} OS selecionadas</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Limpar
            </Button>
            <Button size="sm" disabled={pending} onClick={release}>
              <PackageOpen size={15} /> {pending ? "Liberando…" : "Lentes chegaram · liberar para a bancada"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-[#e2e7e9] bg-white">
        <table className="w-full min-w-[860px] text-left">
          <thead className="bg-[#f7f9f9] text-xs text-[#6e7c7a]">
            <tr>
              <th className="py-2 pl-4 pr-1">
                <input
                  type="checkbox"
                  aria-label="Selecionar todas"
                  className="h-4 w-4 accent-[#0e6b62]"
                  checked={visible.length > 0 && visible.every((item) => selected.has(item.row.id))}
                  onChange={(event) => setSelected(event.target.checked ? new Set(visible.map((item) => item.row.id)) : new Set())}
                />
              </th>
              <th className="px-3 py-2 font-medium">OS · cliente</th>
              <th className="px-3 py-2 font-medium">Prometido ao cliente</th>
              <th className="px-3 py-2 font-medium">Previsão do laboratório</th>
              <th className="px-3 py-2 font-medium">Situação</th>
              <th className="px-3 py-2 font-medium">Entrada</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <Row
                key={item.row.id}
                row={item.row}
                now={now}
                canEdit={canEdit}
                selected={selected.has(item.row.id)}
                onToggle={() =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(item.row.id)) next.delete(item.row.id);
                    else next.add(item.row.id);
                    return next;
                  })
                }
              />
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? <p className="px-4 py-10 text-center text-sm text-[#6e7c7a]">Nenhuma OS aguardando lente neste filtro.</p> : null}
      </div>
    </div>
  );
}
