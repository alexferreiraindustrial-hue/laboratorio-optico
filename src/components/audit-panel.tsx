"use client";
// Auditoria no PDV: progresso da conferência e o que ainda não foi bipado, por posição no sistema.
// A sessão (quais OS já foram conferidas) fica guardada neste computador até começar uma nova.
import { ClipboardCheck, PowerOff, Printer, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { importLocalAudit } from "@/server/audit-actions";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AUDIT_ORDER, AUDIT_POSITIONS, auditPositionOf, type AuditPosition } from "@/lib/domain/audit";
import { AUTO_NUMBER, visibleOrderNumber } from "@/lib/domain/orders";

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

const visible = (row: AuditRow) => {
  const value = visibleOrderNumber(row);
  return AUTO_NUMBER.test(value) ? null : value;
};

export function AuditPanel({ rows, session, onReset, canManage = false }: { rows: AuditRow[] | null; session: AuditSession; onReset: () => void; canManage?: boolean }) {
  const [showMissing, setShowMissing] = useState(false);
  const router = useRouter();
  const [sending, startSending] = useTransition();
  function sendToGeneral() {
    const ids = Object.keys(session.seen);
    if (!window.confirm(`Levar as ${ids.length} OS conferidas para a Auditoria geral? Lá você revisa a lista do que não foi bipado e coloca em off. Nada vai para off antes disso.`)) return;
    startSending(async () => {
      const result = await importLocalAudit(ids);
      if (!result.ok) return void toast.error(result.message);
      toast.success(result.message ?? "Pronto.");
      router.push("/laboratorio/auditoria-geral");
    });
  }
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
        {canManage && Object.keys(session.seen).length ? <button type="button" className="pdv-tool" disabled={sending} onClick={sendToGeneral}><PowerOff size={16} />{sending ? "Levando…" : "Colocar em off o que faltou"}</button> : null}
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
