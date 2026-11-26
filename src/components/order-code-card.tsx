"use client";
// Código da OS: código de barras para bipar, número para copiar e as duas datas lado a lado.
import { ClipboardCopy, ListPlus, ListX, Printer, ScanLine } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { compareForecast } from "@/lib/domain/label-dates";
import { formatDateTime } from "@/lib/format";
import { Barcode } from "./barcode";
import { labelQueue, useLabelQueue } from "./label-queue";

export function ForecastPair({ dueAt, labAt, compact = false }: { dueAt: string | null; labAt: string | null | undefined; compact?: boolean }) {
  const compare = compareForecast(dueAt, labAt);
  return (
    <div className={`oc-dates${compact ? " is-compact" : ""}`}>
      <div><span>Prevista do serviço</span><b>{dueAt ? formatDateTime(dueAt) : "Sem data"}</b></div>
      <div><span>Previsão do laboratório</span><b className={labAt ? "" : "is-empty"}>{labAt ? formatDateTime(labAt) : "Ainda não informada"}</b></div>
      <p className={`oc-compare is-${compare.tone}`}>{compare.label}</p>
    </div>
  );
}

export function OrderCodeCard({ id, number, dueAt, labAt }: { id: string; number: string; dueAt: string | null; labAt: string | null | undefined }) {
  const queued = useLabelQueue().includes(id);
  async function copy() {
    try { await navigator.clipboard.writeText(number); toast.success("Número da OS copiado."); }
    catch { toast.error("Não foi possível copiar."); }
  }
  return (
    <section className="oc-card" aria-label="Código da OS">
      <div className="oc-code">
        <Barcode value={number} height={46} module={2} />
        <div className="oc-number">
          <span>Nº da OS</span>
          <b className="font-mono">{number}</b>
          <button type="button" onClick={copy} className="ocm-trigger"><ClipboardCopy size={15} />Copiar</button>
        </div>
      </div>
      <ForecastPair dueAt={dueAt} labAt={labAt} />
      <div className="oc-actions">
        <Link href={`/laboratorio/etiquetas?ids=${id}`} className="ocm-trigger"><Printer size={15} />Imprimir etiqueta</Link>
        {queued
          ? <button type="button" className="ocm-trigger" onClick={() => { labelQueue.remove([id]); toast.success("Tirada da lista de etiquetas."); }}><ListX size={15} />Tirar da lista</button>
          : <button type="button" className="ocm-trigger" onClick={() => { labelQueue.add([id]); toast.success("Na lista de etiquetas para imprimir depois."); }}><ListPlus size={15} />Pôr na lista de etiquetas</button>}
        <Link href="/pdv" className="ocm-trigger"><ScanLine size={15} />Abrir o PDV</Link>
      </div>
    </section>
  );
}
