"use client";
// Folha de auditoria: todas as OS em aberto, separadas por onde o sistema diz que estão,
// para conferir à mão nas gavetas e na bancada. Só lê dados.
// OS com número da loja saem com QR e código de barras; sem número, só o nome.
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AUDIT_OPEN_STATUSES, AUDIT_ORDER, AUDIT_POSITIONS, auditPositionOf, type AuditPosition } from "@/lib/domain/audit";
import { createClient } from "@/lib/supabase/client";
import { Barcode } from "./barcode";

export type SheetOrder = {
  id: string; number: string; external_order_id: string | null; client_name: string; status: string;
  frame_state: string | null; lens_arrived_at: string | null; entered_at: string; due_at: string | null;
  seller_name: string | null; store_name: string | null;
};
const storeNumber = (order: SheetOrder) => {
  const value = order.external_order_id?.trim();
  return value && value !== order.number ? value : null;
};
const day = (value: string | null) => value ? new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";

export function AuditSheet({ preview }: { preview?: SheetOrder[] } = {}) {
  const [orders, setOrders] = useState<SheetOrder[] | null>(preview ?? null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [only, setOnly] = useState<AuditPosition | "todas">("todas");
  const [printedAt] = useState(() => new Date());

  useEffect(() => {
    if (preview) return;
    let active = true;
    const supabase = createClient();
    void Promise.all([
      supabase.from("service_orders").select("id, number, external_order_id, client_name, status, frame_state, lens_arrived_at, entered_at, due_at").in("status", AUDIT_OPEN_STATUSES).limit(3000),
      supabase.from("orders_enriched").select("id, seller_name, store_name").in("status", AUDIT_OPEN_STATUSES).limit(3000),
    ]).then(([base, extra]) => {
      if (!active) return;
      if (base.error) { setError(base.error.message); return; }
      const names = new Map(((extra.data ?? []) as { id: string; seller_name: string | null; store_name: string | null }[]).map((row) => [row.id, row]));
      setOrders(((base.data ?? []) as Omit<SheetOrder, "seller_name" | "store_name">[]).map((row) => ({ ...row, seller_name: names.get(row.id)?.seller_name ?? null, store_name: names.get(row.id)?.store_name ?? null })));
    });
    return () => { active = false; };
  }, [preview]);

  const groups = useMemo(() => {
    const map = new Map<AuditPosition, SheetOrder[]>();
    for (const order of orders ?? []) {
      const position = auditPositionOf(order);
      if (!position) continue;
      map.set(position, [...(map.get(position) ?? []), order]);
    }
    // Com número primeiro (em ordem), sem número no fim por nome.
    for (const list of map.values()) list.sort((a, b) => {
      const x = storeNumber(a), y = storeNumber(b);
      if (x && y) return x.localeCompare(y, "pt-BR", { numeric: true });
      if (x || y) return x ? -1 : 1;
      return a.client_name.localeCompare(b.client_name, "pt-BR");
    });
    return AUDIT_ORDER.filter((position) => map.get(position)?.length).map((position) => ({ position, items: map.get(position)! }));
  }, [orders]);
  const shown = useMemo(() => only === "todas" ? groups : groups.filter((group) => group.position === only), [groups, only]);
  const total = shown.reduce((sum, group) => sum + group.items.length, 0);

  useEffect(() => {
    const list = shown.flatMap((group) => group.items).filter((order) => storeNumber(order) && !qr[order.id]);
    if (!list.length) return;
    let active = true;
    void import("qrcode").then(async (QRCode) => {
      const next: Record<string, string> = {};
      for (const order of list) next[order.id] = await QRCode.toDataURL(`${window.location.origin}/laboratorio/${order.id}`, { margin: 0, width: 120 });
      if (active) setQr((current) => ({ ...current, ...next }));
    });
    return () => { active = false; };
  }, [shown, qr]);

  if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
  if (!orders) return <p className="text-sm text-[var(--muted)]">Carregando as OS em aberto…</p>;
  return (
    <div className="au">
      <div className="no-print au-toolbar">
        <Link href="/pdv" className="ocm-trigger"><ArrowLeft size={15} />PDV</Link>
        <div className="au-chips" role="radiogroup" aria-label="Imprimir por parte">
          <button type="button" role="radio" aria-checked={only === "todas"} onClick={() => setOnly("todas")}>Todas <b>{orders.length}</b></button>
          {groups.map((group) => <button key={group.position} type="button" role="radio" aria-checked={only === group.position} onClick={() => setOnly(group.position)}>{AUDIT_POSITIONS[group.position]} <b>{group.items.length}</b></button>)}
        </div>
        <button type="button" className="ol-print" onClick={() => window.print()}><Printer size={17} />Imprimir {total}</button>
      </div>

      <div className="au-sheet">
        <header className="au-head">
          <div>
            <h1>Auditoria do laboratório</h1>
            <p>{total} OS em aberto{only === "todas" ? "" : ` · ${AUDIT_POSITIONS[only]}`} · impresso em {printedAt.toLocaleDateString("pt-BR")} às {printedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <dl>
            <div><dt>Conferido por</dt><dd /></div>
            <div><dt>Início</dt><dd className="is-short" /></div>
            <div><dt>Fim</dt><dd className="is-short" /></div>
          </dl>
        </header>
        <p className="au-how">Marque ✓ quando a OS estiver no local da seção. Se estiver em outro lugar, escreva onde achou. Depois corrija no PDV: tecla F8 Auditoria, escolha o local e bipe.</p>

        {shown.map((group) => (
          <section key={group.position} className="au-group">
            <h2><span className="au-box" aria-hidden />{AUDIT_POSITIONS[group.position]}<small>{group.items.length} OS no sistema</small></h2>
            <table>
              <thead>
                <tr><th scope="col" className="au-c-ok">OK</th><th scope="col" className="au-c-code">OS</th><th scope="col">Cliente</th><th scope="col" className="au-c-date">Entrada · Prevista</th><th scope="col" className="au-c-where">Achei em</th></tr>
              </thead>
              <tbody>
                {group.items.map((order) => {
                  const number = storeNumber(order);
                  return (
                    <tr key={order.id}>
                      <td className="au-c-ok"><span className="au-box" aria-label="Quadrado para marcar" /></td>
                      <td className="au-c-code">
                        {number ? (
                          <div className="au-code">
                            {/* QR gerado no navegador, em data URL. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {qr[order.id] ? <img src={qr[order.id]} alt="" /> : <span className="au-qr-wait" />}
                            <div><b className="font-mono">{number}</b><Barcode value={number} height={22} module={0.9} showText={false} className="au-bar" /></div>
                          </div>
                        ) : <span className="au-nonum">sem nº da OS</span>}
                      </td>
                      <td><b className="au-client">{order.client_name}</b><span className="au-sub">{[order.seller_name ? `Vend. ${order.seller_name}` : null, order.store_name].filter(Boolean).join(" · ")}</span></td>
                      <td className="au-c-date">{day(order.entered_at)} · {day(order.due_at)}</td>
                      <td className="au-c-where"><span className="au-line" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
        {total === 0 ? <p className="text-sm">Nenhuma OS em aberto.</p> : null}
        <footer className="au-foot">
          <p>Achou alguma OS que não está nesta lista? Anote aqui: ______________________________________________</p>
        </footer>
      </div>
    </div>
  );
}
