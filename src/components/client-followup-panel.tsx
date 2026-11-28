"use client";
// Pós-venda (versão limpa): lista de clientes à esquerda e o contato à direita, no estilo do WhatsApp.
// Usa os mesmos dados e ações de antes: client_delivery_followups, updateClientFollowup e confirmClientDelivery.
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, ClipboardCopy, HeartHandshake, MessageCircle, PackageCheck, RotateCcw, Search, Send, Smile, ThumbsUp, X } from "lucide-react";
import { CORRECTION_MARK, feedbackMessage, feedbackPending, followupBySeller, followupMetrics, isCorrection, matchesFollowup, percent, STORE_NAME, stripCorrection, type ClientFollowupRow } from "@/lib/domain/client-followup";
import { formatDateTime } from "@/lib/format";
import { updateClientFollowup } from "@/server/fast-operations-actions";
import { sendFollowupMessage } from "@/server/contact-actions";
import { findOrdersForQuick, type FoundOrder } from "@/server/quick-actions";
import { ClientDeliveryForm } from "./client-delivery";
import { Feedback } from "./ui";
import { cn } from "@/lib/utils";

const DAY = 86400000;
const OUTCOMES = [
  { value: "adaptacao_ok", label: "Deu tudo certo", hint: "Adaptou bem, óculos ok", icon: Smile, tone: "ok" },
  { value: "precisa_ajuda", label: "Precisa de ajuste", hint: "Relatou incômodo · chamar para ajustar", icon: HeartHandshake, tone: "late" },
  { value: "correcao", label: "Gerou correção", hint: "Voltou para refazer ou corrigir", icon: RotateCcw, tone: "late" },
  { value: "contato_realizado", label: "Mensagem enviada", hint: "Aguardando a resposta do cliente", icon: Send, tone: "info" },
  { value: "sem_resposta", label: "Sem resposta", hint: "Contato feito, ainda sem retorno", icon: MessageCircle, tone: "warn" },
] as const;
const OUTCOME_LABEL: Record<string, string> = Object.fromEntries(OUTCOMES.map((item) => [item.value, item.label]));
const TABS = [
  { mode: "pending", label: "Contatar agora" },
  { mode: "await", label: "Aguardando 5 dias" },
  { mode: "help", label: "Precisa de ajuste" },
  { mode: "correction", label: "Geraram correção" },
  { mode: "contacted", label: "Já contatados" },
  { mode: "phone", label: "Com WhatsApp" },
  { mode: "all", label: "Todos" },
] as const;

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?";
}
function waLink(phone: string | null, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
function outcomeLabel(row: ClientFollowupRow) {
  if (isCorrection(row)) return "Gerou correção";
  return row.outcome ? OUTCOME_LABEL[row.outcome] ?? row.outcome : null;
}
function rowTone(row: ClientFollowupRow, now: Date) {
  if (row.outcome === "precisa_ajuda") return "late";
  if (row.outcome === "adaptacao_ok") return "ok";
  if (feedbackPending(row, now)) return "warn";
  return "info";
}
function dayInfo(row: ClientFollowupRow, now: Date) {
  const days = Math.max(0, Math.floor((now.getTime() - Date.parse(row.client_delivered_at)) / DAY));
  const progress = Math.min(5, days);
  const label = row.contacted_at ? `Contato em ${formatDateTime(row.contacted_at)}` : feedbackPending(row, now) ? (days > 5 ? `Entregue há ${days} dias · contatar` : "Dia 5 · contatar hoje") : `Dia ${Math.max(1, days)} de 5`;
  return { days, progress, label };
}

export function ClientFollowupPanel({ rows, nowIso }: { rows: ClientFollowupRow[]; nowIso: string }) {
  const [now] = useState(() => new Date(nowIso));
  const [seller, setSeller] = useState("");
  const [mode, setMode] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const sellers = [...new Map(rows.filter((row) => row.seller_id).map((row) => [row.seller_id!, row.seller_name || "Vendedora"])).entries()];
  const counts = useMemo(() => Object.fromEntries(TABS.map((tab) => [tab.mode, rows.filter((row) => matchesFollowup(row, seller, tab.mode, now)).length])), [rows, seller, now]);
  const term = search.trim().toLowerCase();
  const visible = rows.filter((row) => matchesFollowup(row, seller, mode, now) && (!term || `${row.client_name} ${row.number} ${row.seller_name ?? ""}`.toLowerCase().includes(term)));
  const selected = visible.find((row) => row.id === selectedId) ?? visible[0] ?? null;

  return (
    <div className="pv grid gap-4">
      <FollowupMetricsBoard rows={seller ? rows.filter((row) => row.seller_id === seller) : rows} now={now} sellerName={seller ? sellers.find(([id]) => id === seller)?.[1] ?? null : null} />
      <div className="pv-kpis" role="tablist" aria-label="Situação do pós-venda">
        {TABS.map((tab) => (
          <button key={tab.mode} type="button" role="tab" aria-selected={mode === tab.mode} onClick={() => { setMode(tab.mode); setSelectedId(null); }} className="pv-kpi" data-tone={tab.mode === "pending" ? "warn" : tab.mode === "help" || tab.mode === "correction" ? "late" : undefined}>
            <span>{tab.label}</span><strong>{counts[tab.mode] ?? 0}</strong>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="pv-search"><Search size={16} aria-hidden /><span className="sr-only">Buscar cliente ou OS</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, OS ou vendedora" />{search ? <button type="button" aria-label="Limpar busca" onClick={() => setSearch("")} className="grid h-7 w-7 place-items-center rounded-full"><X size={14} /></button> : null}</label>
        <label className="pv-select"><span className="sr-only">Vendedora</span><select value={seller} onChange={(event) => setSeller(event.target.value)}><option value="">Todas as vendedoras</option>{sellers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <button type="button" onClick={() => setRegistering((value) => !value)} aria-expanded={registering} className="pv-btn is-primary ml-auto"><PackageCheck size={17} />Registrar entrega ao cliente</button>
      </div>

      {registering ? <RegisterDelivery rows={rows} onClose={() => setRegistering(false)} /> : null}

      <div className="pv-wrap">
        <ul className="pv-list" aria-label="Clientes no pós-venda">
          {visible.length ? visible.map((row) => {
            const info = dayInfo(row, now);
            const tone = rowTone(row, now);
            return (
              <li key={row.id} className="pv-li">
                <button type="button" aria-pressed={selected?.id === row.id} onClick={() => setSelectedId(row.id)} className="pv-row">
                  <span className="pv-avatar" data-tone={tone} aria-hidden>{initials(row.client_name)}</span>
                  <span className="pv-row-body">
                    <span className="flex items-baseline gap-2"><span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{row.client_name}</span><span className="pv-when" data-tone={tone}>{info.label}</span></span>
                    <span className="flex items-center gap-2 text-[13px] text-[var(--muted)]"><span className="min-w-0 flex-1 truncate"><span className="font-mono text-xs">{row.number}</span> · {row.seller_name || "Sem vendedora"}</span>{outcomeLabel(row) ? <span className="pv-chip" data-tone={tone}>{outcomeLabel(row)}</span> : null}</span>
                  </span>
                </button>
                {waLink(row.client_phone, feedbackMessage(row.client_name, row.number)) ? <a href={waLink(row.client_phone, feedbackMessage(row.client_name, row.number))!} target="_blank" rel="noreferrer" className="pv-wa" aria-label={`Abrir WhatsApp de ${row.client_name}`} title="Abrir no WhatsApp com a mensagem pronta"><MessageCircle size={18} aria-hidden /></a> : null}
              </li>
            );
          }) : <li className="pv-empty">{mode === "pending" ? "Nenhum cliente para contatar agora. Bom trabalho!" : "Nenhum cliente neste filtro."}</li>}
        </ul>
        <section className="pv-detail" aria-label="Contato do pós-venda">
          {selected ? <FollowupDetail key={`${selected.id}-${selected.updated_at}`} row={selected} now={now} /> : (
            <div className="pv-placeholder"><CalendarCheck2 size={40} aria-hidden /><p className="font-semibold">Acompanhe a adaptação dos clientes</p><p className="text-sm text-[var(--muted)]">Ao marcar “Entregue ao cliente”, o contato aparece aqui depois de 5 dias corridos.</p></div>
          )}
        </section>
      </div>
    </div>
  );
}

const PERIODS = [
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "12 meses" },
  { days: 0, label: "Tudo" },
] as const;

/** Indicadores do pós-venda: quantos deram certo, precisaram de ajuste ou geraram correção. */
function FollowupMetricsBoard({ rows, now, sellerName }: { rows: ClientFollowupRow[]; now: Date; sellerName: string | null }) {
  const [days, setDays] = useState<number>(30);
  const from = days ? new Date(now.getTime() - days * DAY) : null;
  const m = followupMetrics(rows, now, from);
  const bySeller = sellerName ? [] : followupBySeller(rows, now, from);
  const parts = [
    { key: "ok", label: "Deu certo", value: m.ok },
    { key: "adjust", label: "Precisa de ajuste", value: m.adjust },
    { key: "fix", label: "Gerou correção", value: m.correction },
    { key: "silent", label: "Sem resposta", value: m.noAnswer },
    { key: "wait", label: "Aguardando resposta", value: m.waitingReply },
  ];
  const barTotal = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <section className="pv-metrics" aria-label="Resultado do pós-venda">
      <header className="pv-metrics-head">
        <div>
          <h2>Resultado do pós-venda</h2>
          <p>Entregas {days ? `dos últimos ${PERIODS.find((p) => p.days === days)?.label}` : "de todo o período"}{sellerName ? ` · ${sellerName}` : ""}. A porcentagem é sobre quem respondeu.</p>
        </div>
        <div className="pv-period" role="radiogroup" aria-label="Período">
          {PERIODS.map((period) => <button key={period.days} type="button" role="radio" aria-checked={days === period.days} onClick={() => setDays(period.days)}>{period.label}</button>)}
        </div>
      </header>
      <div className="pv-metric-grid">
        <div className="pv-metric is-ok"><span>Deu certo</span><strong>{percent(m.ok, m.answered)}</strong><small>{m.ok} de {m.answered} que responderam</small></div>
        <div className="pv-metric is-adjust"><span>Precisa de ajuste</span><strong>{percent(m.adjust, m.answered)}</strong><small>{m.adjust} {m.adjust === 1 ? "cliente" : "clientes"}</small></div>
        <div className="pv-metric is-fix"><span>Gerou correção</span><strong>{percent(m.correction, m.answered)}</strong><small>{m.correction} {m.correction === 1 ? "óculos voltou" : "óculos voltaram"}</small></div>
        <div className="pv-metric"><span>Contatados</span><strong>{percent(m.contacted, m.delivered)}</strong><small>{m.contacted} de {m.delivered} entregas · {m.toContact} para contatar</small></div>
      </div>
      {barTotal ? (
        <div className="pv-bar" role="img" aria-label={parts.filter((p) => p.value).map((p) => `${p.label}: ${p.value}`).join(", ")}>
          {parts.filter((part) => part.value).map((part) => <span key={part.key} className={`is-${part.key}`} style={{ flexGrow: part.value }} title={`${part.label}: ${part.value}`} />)}
        </div>
      ) : <p className="pv-metrics-empty">Ainda não há contatos registrados neste período.</p>}
      {barTotal ? <ul className="pv-legend">{parts.filter((part) => part.value).map((part) => <li key={part.key}><i className={`is-${part.key}`} aria-hidden />{part.label} <b>{part.value}</b></li>)}</ul> : null}
      {bySeller.length > 1 ? (
        <details className="pv-sellers">
          <summary>Por vendedora</summary>
          <div className="pv-table-wrap">
            <table>
              <thead><tr><th scope="col">Vendedora</th><th scope="col">Entregas</th><th scope="col">Contatados</th><th scope="col">Deu certo</th><th scope="col">Ajuste</th><th scope="col">Correção</th><th scope="col">% certo</th></tr></thead>
              <tbody>
                {bySeller.map(({ id, name, metrics }) => (
                  <tr key={id}><th scope="row">{name}</th><td>{metrics.delivered}</td><td>{metrics.contacted}</td><td>{metrics.ok}</td><td>{metrics.adjust}</td><td>{metrics.correction}</td><td><b>{percent(metrics.ok, metrics.answered)}</b></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}

function FollowupDetail({ row, now }: { row: ClientFollowupRow; now: Date }) {
  const router = useRouter();
  const [phone, setPhone] = useState(row.client_phone ?? "");
  const [outcome, setOutcome] = useState<string>("");
  const [note, setNote] = useState(stripCorrection(row.feedback_note));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const info = dayInfo(row, now);
  const text = feedbackMessage(row.client_name, row.number);
  const correction = outcome === "correcao" || (!outcome && isCorrection(row));
  const whatsapp = waLink(phone, text);

  function sendCrm() {
    if (pending) return;
    if (row.contacted_at && !window.confirm("Este cliente já foi contatado. Enviar a mensagem de novo?")) return;
    start(async () => {
      setError(null);
      try {
        const result = await sendFollowupMessage(row.id, phone);
        if (!result.ok) { setError(result.message); return; }
        setMessage(result.message ?? "Mensagem enviada.");
        router.refresh();
      } catch { setError("Não foi possível enviar. Tente de novo."); }
    });
  }

  function save() {
    if (pending) return;
    start(async () => {
      setError(null);
      try {
        const sent = outcome === "correcao" ? "precisa_ajuda" : outcome || null;
        const body = correction ? `${CORRECTION_MARK} ${note.trim()}`.trim() : note;
        const result = await updateClientFollowup(row.id, sent, body, phone, row.updated_at);
        if (!result.ok) { setError(result.message); return; }
        setMessage(result.message);
        router.refresh();
      } catch { setError("Atualize a tela antes de tentar novamente."); }
    });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="pv-head">
        <span className="pv-avatar is-big" data-tone={rowTone(row, now)} aria-hidden>{initials(row.client_name)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-semibold">{row.client_name}</h2>
          <p className="truncate text-[12.5px] text-[var(--muted)]"><Link href={`/laboratorio?os=${row.order_id}`} className="font-mono text-[var(--link)]">{row.number}</Link> · {row.seller_name || "Sem vendedora"}</p>
        </div>
        {outcomeLabel(row) ? <span className="pv-chip" data-tone={rowTone(row, now)}>{outcomeLabel(row)}</span> : null}
      </header>

      <div className="pv-body">
        <div className="pv-timeline" aria-label="Linha do tempo da entrega">
          <div className="flex justify-between text-[12.5px] text-[var(--muted)]"><span>Entregue em <b className="text-[var(--ink)]">{formatDateTime(row.client_delivered_at)}</b></span><span>Contato a partir de <b className="text-[var(--ink)]">{formatDateTime(row.followup_due_at)}</b></span></div>
          <ol className="pv-days">{[1, 2, 3, 4, 5].map((day) => <li key={day} data-done={info.progress >= day || undefined} data-today={info.progress + 1 === day && !feedbackPending(row, now) || undefined}><span>{day}</span></li>)}</ol>
          <p className="text-[12.5px] text-[var(--muted)]">{info.label}</p>
        </div>

        <div className="lg-chat rounded-xl">
          <span className="lg-chat-event">Mensagem da {STORE_NAME} para o cliente</span>
          <p className="lg-bubble" data-out="true">{text}</p>
          {row.feedback_note ? <><span className="lg-chat-event">Retorno registrado</span><p className="lg-bubble">{stripCorrection(row.feedback_note) || "Gerou correção."}</p></> : null}
        </div>

        <label className="grid gap-1 text-sm font-medium">WhatsApp do cliente
          <input type="tel" inputMode="tel" value={phone} maxLength={24} onChange={(event) => setPhone(event.target.value)} placeholder="(12) 99999-9999" className="pv-input" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="pv-btn is-whats" disabled={pending || !whatsapp} title={whatsapp ? "Envia pelo WhatsApp da Goldfinger (CRM) e marca como contatado" : "Informe o telefone com DDD"} onClick={sendCrm}><Send size={17} />Enviar agora</button>
          {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="pv-btn"><MessageCircle size={17} />Abrir no WhatsApp</a> : <span className="pv-btn is-disabled" title="Informe o telefone com DDD"><MessageCircle size={17} />Abrir no WhatsApp</span>}
          <button type="button" className="pv-btn" onClick={async () => { try { await navigator.clipboard.writeText(text); setMessage("Mensagem copiada. Depois de enviar, marque o resultado abaixo."); } catch { setError("Copie o texto da mensagem manualmente."); } }}><ClipboardCopy size={16} />Copiar mensagem</button>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Como foi o contato?</legend>
          <div className="pv-outcomes">
            {OUTCOMES.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.value} type="button" aria-pressed={outcome === item.value} onClick={() => setOutcome(outcome === item.value ? "" : item.value)} className="pv-outcome" data-tone={item.tone}>
                  <Icon size={20} aria-hidden /><span><b>{item.label}</b><small>{item.hint}</small></span>
                </button>
              );
            })}
          </div>
        </fieldset>
        {correction ? <p className="pv-correction"><RotateCcw size={16} aria-hidden /><span>Depois de salvar, abra a correção para a OS <b>{row.number}</b>. A OS original continua guardada.</span><Link href={`/assistencia?original=${encodeURIComponent(row.number)}`} className="pv-btn">Abrir correção</Link></p> : null}
        <label className="grid gap-1 text-sm font-medium">O que o cliente disse?
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} placeholder="Ex.: está enxergando bem de longe, sentiu um pouco de tontura no primeiro dia…" className="pv-input py-2" />
        </label>
        <Feedback error={error} message={message} />
      </div>

      <footer className="pv-foot">
        <span className="text-xs text-[var(--muted)]">{outcome ? `Resultado: ${OUTCOME_LABEL[outcome]}` : "Sem escolher resultado, salva só telefone e observação."}</span>
        <button type="button" disabled={pending} onClick={save} className="pv-btn is-primary"><ThumbsUp size={16} />{pending ? "Salvando…" : "Salvar acompanhamento"}</button>
      </footer>
    </div>
  );
}

/** Dar baixa da entrega ao cliente por número da OS (mesma confirmação de antes). */
function RegisterDelivery({ rows, onClose }: { rows: ClientFollowupRow[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<FoundOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="pv-register">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Registrar entrega ao cliente</h2>
          <p className="text-[13px] text-[var(--muted)]">Bipe ou digite a OS pronta. O pós-venda começa a contar a partir desta confirmação. Dica: na Bancada ou na lista de OS, clique com o botão direito e escolha “Entregue ao cliente”.</p>
        </div>
        <button type="button" aria-label="Fechar" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-secondary)]"><X size={18} /></button>
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        start(async () => {
          setError(null);
          try {
            const result = await findOrdersForQuick(query);
            const ready = result.orders.filter((order) => ["pronto", "entregue"].includes(order.status));
            setFound(ready);
            if (!result.ok) setError(result.message || "Não encontrado.");
            else if (!ready.length) setError("Este serviço ainda não está pronto ou não saiu do laboratório.");
          } catch { setError("Não foi possível consultar a OS."); }
        });
      }}>
        <label className="pv-search flex-1"><Search size={16} aria-hidden /><span className="sr-only">Número da OS</span><input required value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Número da OS" /></label>
        <button type="submit" disabled={pending} className="pv-btn is-primary">{pending ? "Buscando…" : "Localizar"}</button>
      </form>
      {found.map((order) => (
        <div key={order.id} className="mt-3">
          <strong className={cn("text-sm")}>{order.number} · {order.client_name}</strong>
          <ClientDeliveryForm id={order.id} status={order.status} delivery={rows.find((row) => row.order_id === order.id)} />
        </div>
      ))}
      <Feedback error={error} />
    </section>
  );
}
