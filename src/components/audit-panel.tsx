"use client";
// Auditoria no PDV: progresso da conferência e o que ainda não foi bipado, por posição no sistema.
// A sessão (quais OS já foram conferidas) fica guardada neste computador até começar uma nova.
import { ClipboardCheck, Printer, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AUDIT_ORDER, AUDIT_POSITIONS, auditPositionOf, type AuditPosition } from "@/lib/domain/audit";

export type AuditRow = { id: string; number: string; external_order_id: string | null; client_name: string; status: string; frame_state: string | null; lens_arrived_at: string | null };
export type AuditSession = { startedAt: string; seen: Record<string, { at: string; changed: boolean }> };

const KEY = "lab-gold:auditoria";
export function loadAuditSession(): AuditSession {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AuditSession;
  } catch { /* sem armazenamento */ }
  return { startedAt: new Date().toISOString(), seen: {} };
}
export function saveAuditSession(session: AuditSession) {
  try { window.localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* sem armazenamento */ }
}

const visible = (row: AuditRow) => row.external_order_id && row.external_order_id !== row.number ? row.external_order_id : null;

export function AuditPanel({ rows, session, onReset }: { rows: AuditRow[] | null; session: AuditSession; onReset: () => void }) {
  const [showMissing, setShowMissing] = useState(false);
  const stats = useMemo(() => {
    if (!rows) return null;
    const missing = new Map<AuditPosition, AuditRow[]>();
    let checked = 0;
    for (const row of rows) {
      if (session.seen[row.id]) { checked++; continue; }
      const position = auditPositionOf(row);
      if (!position) continue;
      missing.set(position, [...(missing.get(position) ?? []), row]);
    }
    const changed = Object.values(session.seen).filter((item) => item.changed).length;
    return { total: rows.length, checked, changed, missing };
  }, [rows, session]);
  const started = new Date(session.startedAt);
  return (
    <section className="pdv-audit" aria-label="Auditoria">
      <div className="pdv-audit-head">
        <ClipboardCheck size={20} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2>Auditoria do laboratório</h2>
          <p>Começou {started.toLocaleDateString("pt-BR")} às {started.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Bipe tudo o que está no local escolhido; o sistema confere ou corrige.</p>
        </div>
        <Link href="/laboratorio/auditoria" className="pdv-tool"><Printer size={16} />Folha para imprimir</Link>
        <button type="button" className="pdv-tool" onClick={() => { if (window.confirm("Começar uma nova auditoria? A contagem desta será zerada (nada muda nas OS).")) onReset(); }}><RotateCcw size={16} />Nova auditoria</button>
      </div>
      {stats ? (
        <>
          <div className="pdv-audit-bar" role="progressbar" aria-valuemin={0} aria-valuemax={stats.total} aria-valuenow={stats.checked} aria-label="OS conferidas">
            <span style={{ width: `${stats.total ? (stats.checked / stats.total) * 100 : 0}%` }} />
          </div>
          <p className="pdv-audit-count"><b>{stats.checked}</b> de {stats.total} OS em aberto conferidas · <b>{stats.changed}</b> corrigidas · <b>{stats.total - stats.checked}</b> faltam</p>
          <button type="button" className="pdv-audit-toggle" aria-expanded={showMissing} onClick={() => setShowMissing((value) => !value)}>{showMissing ? "Esconder" : "Ver"} as que faltam conferir</button>
          {showMissing ? (
            <div className="pdv-audit-missing">
              {AUDIT_ORDER.filter((position) => stats.missing.get(position)?.length).map((position) => (
                <div key={position}>
                  <h3>No sistema: {AUDIT_POSITIONS[position]} <span>{stats.missing.get(position)!.length}</span></h3>
                  <ul>
                    {stats.missing.get(position)!.map((row) => (
                      <li key={row.id} data-os-id={row.id}><Link href={`/laboratorio/${row.id}`}>{visible(row) ? <b className="font-mono">{visible(row)}</b> : <b>sem nº</b>}{row.client_name}</Link></li>
                    ))}
                  </ul>
                </div>
              ))}
              {stats.total === stats.checked ? <p className="pdv-audit-done">Tudo conferido. Nenhuma OS em aberto ficou sem bipe.</p> : <p className="pdv-audit-note">As que sobrarem no fim: procure na bancada e nas gavetas. Se não achar, abra a OS e veja o histórico.</p>}
            </div>
          ) : null}
        </>
      ) : <p className="pdv-audit-count">Carregando as OS em aberto…</p>}
    </section>
  );
}
