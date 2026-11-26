"use client";
// Etiquetas de OS: escolher várias e imprimir de uma vez, com código de barras e as duas datas.
// Só lê dados. A "lista de etiquetas" fica guardada neste computador.
import { ArrowLeft, CheckSquare, ListX, Printer, Search, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { STATUS_LABEL, type OrderStatus } from "@/lib/domain/constants";
import { compareForecast, shortDate } from "@/lib/domain/label-dates";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { LensSpec } from "@/lib/types";
import { Barcode } from "./barcode";
import { labelQueue, useLabelQueue, usePrintedLabels } from "./label-queue";

type LabelOrder = {
  id: string; number: string; client_name: string; store_name: string | null; seller_name: string | null; laboratory_name: string | null;
  external_order_id: string | null; entered_at: string; due_at: string | null; lens_expected_at: string | null; status: OrderStatus;
  service_description: string | null; lens_spec: LensSpec | null;
};
const FIELDS = "id, number, client_name, store_name, seller_name, laboratory_name, external_order_id, entered_at, due_at, lens_expected_at, status, service_description, lens_spec";

function eye(spec: LensSpec | null, side: "od" | "oe") {
  if (!spec) return "—";
  const sphere = spec[`${side}_sphere`] || "—";
  const cylinder = spec[`${side}_cylinder`] || "";
  const axis = spec[`${side}_axis`] || "—";
  return `${sphere} ${cylinder} eixo ${axis}`.replace(/\s+/g, " ").trim();
}

function OrderLabel({ order, qr }: { order: LabelOrder; qr?: string }) {
  const number = visibleOrderNumber(order);
  const compare = compareForecast(order.due_at, order.lens_expected_at);
  return (
    <article className="ol-label">
      <header>
        <div className="min-w-0">
          <p className="ol-number font-mono">{number}</p>
          <p className="ol-client">{order.client_name}</p>
        </div>
        {/* QR gerado no navegador, em data URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr ? <img src={qr} alt="" className="ol-qr" /> : <span className="ol-qr" />}
      </header>
      <Barcode value={number} height={34} module={1.25} showText={false} className="ol-barcode" />
      <div className="ol-dates">
        <div><span>Prevista</span><b>{order.due_at ? formatDateTime(order.due_at) : "____/____"}</b></div>
        <div><span>Prev. laboratório</span><b>{order.lens_expected_at ? shortDate(order.lens_expected_at) : <i className="ol-blank" aria-label="Espaço para escrever à mão" />}</b></div>
      </div>
      {order.lens_expected_at && compare.tone === "risco" ? <p className="ol-alert">⚠ {compare.label}</p> : null}
      <p className="ol-line">{[order.store_name, order.seller_name ? `Vend. ${order.seller_name}` : null, order.laboratory_name].filter(Boolean).join(" · ")}</p>
      {order.service_description ? <p className="ol-line">{order.service_description}</p> : null}
      <p className="ol-line ol-rx">OD {eye(order.lens_spec, "od")} · OE {eye(order.lens_spec, "oe")}{order.lens_spec?.addition ? ` · Ad ${order.lens_spec.addition}` : ""}</p>
      {order.lens_spec?.frame ? <p className="ol-line">Armação {order.lens_spec.frame}</p> : null}
    </article>
  );
}

/** Folha de impressão das OS escolhidas. */
export function OrderLabelPrint({ ids }: { ids: string[] }) {
  const router = useRouter();
  const queue = useLabelQueue();
  const [orders, setOrders] = useState<LabelOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [printed, setPrinted] = useState(false);
  const key = ids.join(",");

  useEffect(() => {
    let active = true;
    const list = key.split(",").slice(0, 200);
    void createClient().from("orders_enriched").select(FIELDS).in("id", list).then(({ data, error: queryError }) => {
      if (!active) return;
      if (queryError) { setError(queryError.message); return; }
      const byId = new Map(((data ?? []) as LabelOrder[]).map((order) => [order.id, order]));
      setOrders(list.map((id) => byId.get(id)).filter(Boolean) as LabelOrder[]);
    });
    return () => { active = false; };
  }, [key]);

  useEffect(() => {
    if (!orders?.length) return;
    let active = true;
    void import("qrcode").then(async (QRCode) => {
      const next: Record<string, string> = {};
      for (const order of orders) next[order.id] = await QRCode.toDataURL(`${window.location.origin}/laboratorio/${order.id}`, { margin: 0, width: 160 });
      if (active) setQr(next);
    });
    return () => { active = false; };
  }, [orders]);

  if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
  if (!orders) return <p className="text-sm text-[var(--muted)]">Carregando etiquetas…</p>;
  const inQueue = orders.filter((order) => queue.includes(order.id)).map((order) => order.id);
  return (
    <div>
      <div className="no-print ol-toolbar">
        <Link href="/laboratorio/etiquetas" className="ocm-trigger"><ArrowLeft size={15} />Escolher outras</Link>
        <p className="mr-auto text-sm"><b>{orders.length}</b> etiqueta{orders.length === 1 ? "" : "s"} · sem previsão do laboratório sai um espaço em branco para escrever à mão.</p>
        <button type="button" className="ol-print" onClick={() => { labelQueue.markPrinted(orders.map((order) => order.id)); setPrinted(true); window.print(); }}><Printer size={17} />Imprimir</button>
      </div>
      {printed && inQueue.length ? (
        <div className="no-print ol-after">
          <p>Saíram certinho? Tire da lista de etiquetas para não imprimir de novo.</p>
          <button type="button" className="ocm-trigger" onClick={() => { labelQueue.remove(inQueue); toast.success("Tiradas da lista."); router.push("/laboratorio/etiquetas"); }}><ListX size={15} />Tirar {inQueue.length} da lista</button>
        </div>
      ) : null}
      {orders.length === 0 ? <p className="text-sm">Nenhuma OS encontrada.</p> : null}
      <div className="ol-sheet">{orders.map((order) => <OrderLabel key={order.id} order={order} qr={qr[order.id]} />)}</div>
    </div>
  );
}

const PERIODS = [{ key: "aberto", label: "Todas em aberto" }, { key: "1", label: "Entraram hoje" }, { key: "3", label: "3 dias" }, { key: "7", label: "7 dias" }, { key: "30", label: "30 dias" }] as const;

/** Categorias para imprimir por partes (etapa da OS). */
const CATEGORIES: { key: string; label: string; statuses: OrderStatus[] | null }[] = [
  { key: "todas", label: "Todas", statuses: null },
  { key: "lentes", label: "Aguardando lentes", statuses: ["aguardando_lentes"] },
  { key: "montagem", label: "Aguardando montagem", statuses: ["aguardando_montagem"] },
  { key: "bancada", label: "Em montagem", statuses: ["em_montagem", "em_correcao"] },
  { key: "medico", label: "No médico", statuses: ["em_conferencia"] },
  { key: "pronto", label: "Pronto", statuses: ["pronto"] },
  { key: "entregue", label: "Entregue", statuses: ["entregue"] },
];

/** Escolher as OS para imprimir: lista recente + "lista de etiquetas" guardada. */
export function OrderLabelPicker() {
  const router = useRouter();
  const queue = useLabelQueue();
  const printedIds = usePrintedLabels();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("aberto");
  const [category, setCategory] = useState("todas");
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [rows, setRows] = useState<LabelOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const selected = useMemo(() => picked ?? new Set(queue), [picked, queue]);
  const queueKey = queue.join(",");

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    let recent;
    if (period === "aberto") {
      recent = supabase.from("orders_enriched").select(FIELDS).not("status", "in", "(entregue,cancelado)").order("entered_at", { ascending: false }).limit(600);
    } else {
      const since = new Date(Date.now() - Number(period) * 864e5);
      if (period === "1") since.setHours(0, 0, 0, 0);
      recent = supabase.from("orders_enriched").select(FIELDS).gte("entered_at", since.toISOString()).not("status", "in", "(cancelado)").order("entered_at", { ascending: false }).limit(400);
    }
    const queued = queueKey ? supabase.from("orders_enriched").select(FIELDS).in("id", queueKey.split(",")) : Promise.resolve({ data: [], error: null });
    void Promise.all([recent, queued]).then(([a, b]) => {
      if (!active) return;
      if (a.error || b.error) { setError((a.error ?? b.error)!.message); return; }
      const map = new Map<string, LabelOrder>();
      for (const row of [...((b.data ?? []) as LabelOrder[]), ...((a.data ?? []) as LabelOrder[])]) map.set(row.id, row);
      setRows([...map.values()]);
    });
    return () => { active = false; };
  }, [period, queueKey]);

  const statuses = CATEGORIES.find((item) => item.key === category)?.statuses ?? null;
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (rows ?? []).filter((row) => {
      if (statuses && !statuses.includes(row.status)) return false;
      if (onlyPending && printedIds.includes(row.id)) return false;
      if (!text) return true;
      return [row.number, row.external_order_id, row.client_name, row.seller_name, row.store_name].some((value) => value?.toLowerCase().includes(text));
    }).sort((a, b) => Number(queue.includes(b.id)) - Number(queue.includes(a.id)));
  }, [rows, query, onlyPending, printedIds, queue, statuses]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  }
  const allVisible = visible.length > 0 && visible.every((row) => selected.has(row.id));
  const chosen = [...selected];

  return (
    <div className="ol-picker">
      <div className="ol-picker-head">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--link)]">Etiquetas</p>
          <h1 className="text-2xl font-semibold">Preparar etiquetas</h1>
          <p className="text-sm text-[var(--muted)]">Marque as OS e imprima tudo de uma vez. As que você pôs na lista (botão direito › Pôr na lista de etiquetas) já vêm marcadas.</p>
        </div>
      </div>
      <div className="ol-filters">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período de entrada">
          {PERIODS.map((item) => <button key={item.key} type="button" aria-pressed={period === item.key} onClick={() => setPeriod(item.key)} className="ol-chip">{item.label}</button>)}
        </div>
        <div className="ol-cats" role="group" aria-label="Etapa da OS">
          {CATEGORIES.filter((item) => item.key !== "entregue" || period !== "aberto").map((item) => {
            const count = (rows ?? []).filter((row) => !item.statuses || item.statuses.includes(row.status)).length;
            return <button key={item.key} type="button" aria-pressed={category === item.key} onClick={() => setCategory(item.key)} className="ol-cat">{item.label}<b>{rows ? count : "…"}</b></button>;
          })}
        </div>
        <label className="ol-search"><Search size={16} aria-hidden /><span className="sr-only">Buscar</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="OS, cliente, vendedora ou loja" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} className="h-4 w-4" />Só as ainda não impressas</label>
      </div>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {!rows ? <p className="text-sm text-[var(--muted)]">Carregando OS…</p> : (
        <div className="ol-list">
          <button type="button" className="ol-row is-head" onClick={() => { const next = new Set(selected); for (const row of visible) { if (allVisible) next.delete(row.id); else next.add(row.id); } setPicked(next); }}>
            {allVisible ? <CheckSquare size={18} /> : <Square size={18} />}<span>{allVisible ? "Desmarcar" : "Marcar"} as {visible.length} {category === "todas" ? "da lista" : `de "${CATEGORIES.find((item) => item.key === category)?.label}"`}</span>
          </button>
          {visible.map((row) => {
            const on = selected.has(row.id);
            return (
              <button key={row.id} type="button" data-os-id={row.id} aria-pressed={on} className={`ol-row${on ? " is-on" : ""}`} onClick={() => toggle(row.id)}>
                {on ? <CheckSquare size={18} /> : <Square size={18} />}
                <span className="ol-row-main"><b className="font-mono">{visibleOrderNumber(row)}</b> · {row.client_name}<small>{[row.seller_name, row.store_name].filter(Boolean).join(" · ")} · entrou {shortDate(row.entered_at)}</small></span>
                <span className="ol-row-dates"><small>Prevista</small>{row.due_at ? shortDate(row.due_at) : "—"}<small>Lab.</small>{row.lens_expected_at ? shortDate(row.lens_expected_at) : "—"}</span>
                <span className="ol-row-tags">{queue.includes(row.id) ? <em className="is-queue">Na lista</em> : null}{printedIds.includes(row.id) ? <em>Impressa</em> : null}<em className="is-status">{STATUS_LABEL[row.status] ?? row.status}</em></span>
              </button>
            );
          })}
          {visible.length === 0 ? <p className="p-4 text-sm text-[var(--muted)]">Nenhuma OS neste período.</p> : null}
        </div>
      )}
      <div className="ol-bar">
        <span className="mr-auto text-sm"><b>{chosen.length}</b> marcada{chosen.length === 1 ? "" : "s"}{queue.length ? ` · ${queue.length} na lista` : ""}</span>
        {queue.length ? <button type="button" className="ocm-trigger" onClick={() => { labelQueue.clear(); setPicked(new Set()); toast.success("Lista de etiquetas limpa."); }}><ListX size={15} />Limpar lista</button> : null}
        <button type="button" className="ol-print" disabled={chosen.length === 0} onClick={() => router.push(`/laboratorio/etiquetas?ids=${chosen.slice(0, 200).join(",")}`)}><Printer size={17} />Ver e imprimir {chosen.length || ""}</button>
      </div>
    </div>
  );
}
