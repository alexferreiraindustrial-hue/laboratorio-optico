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

function useLensForecast(row: LensQueueRow) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(row.lens_expected_at ? ymd.format(new Date(row.lens_expected_at)) : "");
  const [ref, setRef] = useState(row.lens_supplier_ref ?? "");

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

  return { pending, date, setDate, ref, setRef, save };
}

function ForecastFields({
  date,
  supplierRef,
  onDate,
  onRef,
  onBlurRef,
}: {
  date: string;
  supplierRef: string;
  onDate: (value: string) => void;
  onRef: (value: string) => void;
  onBlurRef: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="date"
        value={date}
        onChange={(event) => onDate(event.target.value)}
        className="h-11 w-full rounded-md border border-[#d5cbbb] px-2 text-base outline-none focus:border-[#0b5c54] md:h-9 md:w-[160px] md:text-[13px]"
        aria-label="Previsão do laboratório"
      />
      <input
        value={supplierRef}
        onChange={(event) => onRef(event.target.value.slice(0, 60))}
        onBlur={onBlurRef}
        placeholder="nº do pedido"
        className="h-11 w-full rounded-md border border-transparent bg-[#f8f3ea] px-2 text-base outline-none focus:border-[#0b5c54] md:h-8 md:w-[160px] md:text-xs"
      />
    </div>
  );
}

function Row({ row, now, selected, onToggle, canEdit }: { row: LensQueueRow; now: Date; selected: boolean; onToggle: () => void; canEdit: boolean }) {
  const { pending, date, setDate, ref, setRef, save } = useLensForecast(row);
  const risk = lensRisk({ dueAt: row.due_at, lensExpectedAt: row.lens_expected_at, now });
  const tone = LENS_RISK[risk.risk];

  return (
    <tr className={cn("border-t border-[#efe8dc] transition-colors", selected ? "bg-[#f0f7f6]" : "hover:bg-[#fafbfb]", pending && "opacity-60")}>
      <td className="py-2.5 pl-4 pr-1">
        <input type="checkbox" checked={selected} onChange={onToggle} className="h-5 w-5 accent-[#0b5c54]" aria-label={`Selecionar ${row.number}`} />
      </td>
      <td className="px-3 py-2.5">
        <Link href={`/laboratorio/${row.id}`} className="font-mono text-xs font-semibold text-[#0b5c54] hover:underline">
          {visibleOrderNumber(row)}
        </Link>
        <p className="max-w-[220px] truncate text-sm font-semibold">{row.client_name}</p>
        <p className="max-w-[220px] truncate text-xs font-semibold text-[#0a4540]">{row.laboratory_name || "Sem laboratório"}</p>
        <p className="max-w-[220px] truncate text-xs text-[#6b6358]">{[row.seller_name, row.store_name].filter(Boolean).join(" · ") || "Sem vendedor"}</p>
      </td>
      <td className="px-3 py-2.5 text-sm">
        {row.due_at ? fmt.format(new Date(row.due_at)) : <span className="text-[#8a8173]">sem prazo</span>}
        {risk.latestArrival ? <p className="text-[11px] text-[#6b6358]">lente até {fmt.format(risk.latestArrival)}</p> : null}
      </td>
      <td className="px-3 py-2.5">
        {canEdit ? (
          <ForecastFields
            date={date}
            supplierRef={ref}
            onDate={(value) => {
              setDate(value);
              save(value, ref);
            }}
            onRef={setRef}
            onBlurRef={() => save(date, ref)}
          />
        ) : (
          <span className="text-sm">{row.lens_expected_at ? fmt.format(new Date(row.lens_expected_at)) : "—"}</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold" style={{ color: tone.fg, background: tone.bg }}>
          {tone.label}
        </span>
        <p className="mt-0.5 text-[11px] text-[#6b6358]">{risk.risk === "ok" || risk.risk === "apertado" || risk.risk === "vai_atrasar" ? slackText(risk.slackHours) : ""}</p>
      </td>
      <td className="px-3 py-2.5 text-xs text-[#6b6358]">{fmt.format(new Date(row.entered_at))}</td>
    </tr>
  );
}

function LensCard({ row, now, selected, onToggle, canEdit }: { row: LensQueueRow; now: Date; selected: boolean; onToggle: () => void; canEdit: boolean }) {
  const { pending, date, setDate, ref, setRef, save } = useLensForecast(row);
  const risk = lensRisk({ dueAt: row.due_at, lensExpectedAt: row.lens_expected_at, now });
  const tone = LENS_RISK[risk.risk];
  return (
    <article className={cn("rounded-xl border bg-white p-3.5", selected ? "border-[#0b5c54] bg-[#f0f7f6]" : "border-[#e6dcce]", pending && "opacity-60")}>
      <div className="flex items-start gap-3">
        <label className="grid h-11 w-11 shrink-0 place-items-center">
          <input type="checkbox" checked={selected} onChange={onToggle} className="h-5 w-5 accent-[#0b5c54]" aria-label={`Selecionar ${row.number}`} />
        </label>
        <div className="min-w-0 flex-1">
          <Link href={`/laboratorio/${row.id}`} className="font-mono text-[13px] font-semibold text-[#0b5c54]">
            {visibleOrderNumber(row)}
          </Link>
          <p className="truncate text-[16px] font-semibold leading-snug">{row.client_name}</p>
          <p className="truncate text-xs font-semibold text-[#0a4540]">{row.laboratory_name || "Sem laboratório"}</p>
          <p className="truncate text-xs text-[#6b6358]">{[row.seller_name, row.store_name].filter(Boolean).join(" · ") || "Sem vendedor"}</p>
          <p className="mt-1 text-xs text-[#6b6358]">
            Cliente: {row.due_at ? fmt.format(new Date(row.due_at)) : "sem prazo"}
            {risk.latestArrival ? ` · lente até ${fmt.format(risk.latestArrival)}` : ""}
          </p>
          <span className="mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-semibold" style={{ color: tone.fg, background: tone.bg }}>
            {tone.label}
          </span>
          {risk.risk === "ok" || risk.risk === "apertado" || risk.risk === "vai_atrasar" ? (
            <p className="mt-0.5 text-[11px] text-[#6b6358]">{slackText(risk.slackHours)}</p>
          ) : null}
          <div className="mt-3">
            {canEdit ? (
              <ForecastFields
                date={date}
                supplierRef={ref}
                onDate={(value) => {
                  setDate(value);
                  save(value, ref);
                }}
                onRef={setRef}
                onBlurRef={() => save(date, ref)}
              />
            ) : (
              <span className="text-sm">{row.lens_expected_at ? fmt.format(new Date(row.lens_expected_at)) : "Sem previsão"}</span>
            )}
          </div>
        </div>
      </div>
    </article>
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
      (!text || `${item.row.number} ${item.row.external_order_id ?? ""} ${item.row.client_name} ${item.row.seller_name ?? ""} ${item.row.store_name ?? ""} ${item.row.laboratory_name ?? ""} ${item.row.lens_supplier_ref ?? ""}`.toLowerCase().includes(text)),
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
                "flex h-11 min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors md:h-8 md:min-h-8 md:px-2.5 md:text-[13px]",
                filter === key ? "border-[#1a1714] bg-[#1a1714] text-white" : "border-[#e6dcce] bg-white text-[#4a453d] hover:border-[#d5cbbb]",
              )}
            >
              {tone ? <span className="h-2 w-2 rounded-full" style={{ background: tone.bg === "#b42318" ? "#b42318" : tone.fg }} /> : null}
              {key === "todas" ? "Todas" : tone!.label}
              <span className="font-mono text-xs opacity-80">{count}</span>
            </button>
          );
        })}
        <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-[#e6dcce] bg-white px-2.5 text-[#6b6358] sm:ml-auto sm:w-auto md:h-9">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="OS, cliente, pedido" className="min-w-0 flex-1 bg-transparent text-base text-[#1a1714] outline-none sm:w-40 md:text-sm" />
        </label>
      </div>

      {selected.size > 0 && canRelease ? (
        <div className="sticky top-[68px] z-10 flex flex-col gap-3 rounded-xl border border-[#0b5c54] bg-[#d8ebe6] px-4 py-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span className="text-sm font-semibold text-[#0a4540]">{selected.size} OS selecionadas</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="w-full sm:w-auto">
              Limpar
            </Button>
            <Button size="sm" disabled={pending} onClick={release} className="w-full sm:w-auto">
              <PackageOpen size={15} /> {pending ? "Liberando…" : "Lentes chegaram · liberar para a bancada"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 md:hidden">
        {visible.map((item) => (
          <LensCard
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
        {visible.length === 0 ? <p className="rounded-xl border border-dashed border-[#d5cbbb] bg-white px-4 py-10 text-center text-sm text-[#6b6358]">Nenhuma OS aguardando lente neste filtro.</p> : null}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-[#e6dcce] bg-white md:block">
        <table className="w-full min-w-[860px] text-left">
          <thead className="bg-[#f8f3ea] text-xs text-[#6b6358]">
            <tr>
              <th className="py-2 pl-4 pr-1">
                <input
                  type="checkbox"
                  aria-label="Selecionar todas"
                  className="h-5 w-5 accent-[#0b5c54]"
                  checked={visible.length > 0 && visible.every((item) => selected.has(item.row.id))}
                  onChange={(event) => setSelected(event.target.checked ? new Set(visible.map((item) => item.row.id)) : new Set())}
                />
              </th>
              <th className="px-3 py-2 font-medium">OS · laboratório</th>
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
        {visible.length === 0 ? <p className="px-4 py-10 text-center text-sm text-[#6b6358]">Nenhuma OS aguardando lente neste filtro.</p> : null}
      </div>
    </div>
  );
}
