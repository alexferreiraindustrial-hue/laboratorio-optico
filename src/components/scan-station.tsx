"use client";
// PDV da produção: escolhe a ação (teclas F1–F5) e bipa as OS uma atrás da outra.
// Cada bipe usa uma ação que o sistema já tinha (mesmas regras e histórico de sempre).
// Ao lado, o cupom do turno; embaixo, o radar das OS atrasadas ou perto de atrasar.
import { Camera, CameraOff, Check, Expand, PackageCheck, PackageOpen, ScanLine, Shrink, Stethoscope, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { STATUS_LABEL, type AppRole, type OrderStatus } from "@/lib/domain/constants";
import { deadlineText, RADAR_STATUSES, radarGroups, type RadarLane, type RadarOrder } from "@/lib/domain/pdv";
import { can } from "@/lib/domain/permissions";
import { isPublicCode } from "@/lib/domain/qr";
import { parseScanCode, SCAN_ACTIONS, scanBlockReason, type ScanAction } from "@/lib/domain/scan";
import { createClient } from "@/lib/supabase/client";
import { changeOrderStatus } from "@/server/actions";
import { confirmClientDelivery } from "@/server/fast-operations-actions";
import { approveMedicalReview } from "@/server/followup-actions";
import { quickMoveOrders } from "@/server/quick-actions";

const ICONS: Record<ScanAction, typeof Check> = { lente: PackageOpen, pronto: Check, medico: Stethoscope, voltou: Undo2, entregue: PackageCheck };
const ORDER: ScanAction[] = ["lente", "pronto", "medico", "voltou", "entregue"];
const KEYS: Record<ScanAction, string> = { lente: "F1", pronto: "F2", medico: "F3", voltou: "F4", entregue: "F5" };

type Found = { id: string; number: string; external_order_id: string | null; client_name: string; status: string; medical_review_required: boolean | null; medical_review_approved_at: string | null; updated_at: string };
type LogItem = { key: number; at: string; code: string; ok: boolean; title: string; client?: string; detail: string; action: ScanAction; id?: string };
type Display = { tone: "idle" | "ok" | "err" | "busy"; number: string; client: string; line: string };

export function allowedScanActions(role: AppRole): ScanAction[] {
  return ORDER.filter((action) => {
    if (action === "entregue") return ["admin", "gestor"].includes(role) && can(role, "orders.deliver");
    if (action === "voltou") return can(role, "orders.write");
    return can(role, "orders.status");
  });
}

function beep(ok: boolean) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.frequency.value = ok ? 1250 : 320; gain.gain.value = 0.08;
    osc.connect(gain); gain.connect(ctx.destination); osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.09 : 0.35));
    osc.onended = () => void ctx.close();
  } catch { /* sem som */ }
}

const SAFE_REF = /^[\w\-./ ]+$/;
const visible = (order: { number: string; external_order_id: string | null }) => order.external_order_id && order.external_order_id !== order.number ? order.external_order_id : order.number;

async function findOrder(raw: string): Promise<{ order?: Found; error?: string }> {
  const target = parseScanCode(raw);
  if (!target) return { error: "Código não reconhecido." };
  const supabase = createClient();
  const fields = "id, number, external_order_id, client_name, status, medical_review_required, medical_review_approved_at, updated_at";
  if (target.id) {
    const { data, error } = await supabase.from("orders_enriched").select(fields).eq("id", target.id).maybeSingle();
    if (error) return { error: error.message };
    return data ? { order: data as Found } : { error: "OS não encontrada." };
  }
  const ref = target.ref!;
  if (!SAFE_REF.test(ref)) return { error: "Código com caracteres estranhos. Confira o leitor." };
  const { data, error } = await supabase.from("orders_enriched").select(fields).or(`number.eq."${ref}",external_order_id.eq."${ref}"`).not("status", "eq", "cancelado").limit(3);
  if (error) return { error: error.message };
  const rows = (data ?? []) as Found[];
  if (rows.length === 0) return { error: `Nenhuma OS com o número ${ref}.` };
  if (rows.length > 1) return { error: `Mais de uma OS com o número ${ref}. Abra pela busca.` };
  return { order: rows[0] };
}

async function run(action: ScanAction, order: Found) {
  switch (action) {
    case "lente": {
      const result = await quickMoveOrders([order.id], "aguardando_montagem", "Bipe: lente chegou");
      const item = result.results[0];
      return { ok: Boolean(item?.ok), message: item?.ok ? (item.waitingFrame ? "Lente recebida. VTA: aguardando armação." : "Lente recebida. Foi para a bancada.") : item?.message ?? result.message };
    }
    case "pronto": return changeOrderStatus(order.id, "pronto", "Bipe: ficou pronto");
    case "medico": return changeOrderStatus(order.id, "em_conferencia", "Bipe: foi para o médico");
    case "voltou": return approveMedicalReview(order.id, "Bipe: voltou do médico, conferido e liberado", order.updated_at);
    case "entregue": return confirmClientDelivery(order.id, "", new Date().toISOString());
  }
}

const DONE: Record<ScanAction, string> = { lente: "Lente registrada", pronto: "Marcada como pronta", medico: "Enviada ao médico", voltou: "Liberada pelo médico", entregue: "Entregue ao cliente" };

export function ScanStation({ role, embedded = false }: { role: AppRole; embedded?: boolean }) {
  const router = useRouter();
  const actions = allowedScanActions(role);
  const [action, setAction] = useState<ScanAction | null>(actions[0] ?? null);
  const [code, setCode] = useState("");
  const [log, setLog] = useState<LogItem[]>([]);
  const [display, setDisplay] = useState<Display>({ tone: "idle", number: "", client: "", line: "" });
  const [pending, start] = useTransition();
  const [camera, setCamera] = useState(false);
  const [full, setFull] = useState(false);
  const [radar, setRadar] = useState<RadarOrder[] | null>(null);
  const [now, setNow] = useState(() => new Date());
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const last = useRef<{ code: string; at: number } | null>(null);

  const loadRadar = useCallback(async () => {
    const { data } = await createClient().from("orders_enriched")
      .select("id, number, external_order_id, client_name, status, due_at, lens_expected_at, seller_name")
      .in("status", RADAR_STATUSES).limit(800);
    if (data) { setRadar(data as RadarOrder[]); setNow(new Date()); }
  }, []);

  useEffect(() => {
    let active = true;
    const tick = () => { if (active) void loadRadar(); };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [loadRadar]);

  useEffect(() => { input.current?.focus(); }, [action]);

  // Teclas F1–F5 trocam a ação, como num caixa.
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const hit = actions.find((key) => KEYS[key] === event.key);
      if (!hit) return;
      event.preventDefault();
      setAction(hit);
    };
    const onFull = () => setFull(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", keys);
    document.addEventListener("fullscreenchange", onFull);
    return () => { window.removeEventListener("keydown", keys); document.removeEventListener("fullscreenchange", onFull); };
  }, [actions]);

  function push(item: Omit<LogItem, "key" | "at">) {
    beep(item.ok);
    setLog((current) => [{ ...item, key: ++seq.current, at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) }, ...current].slice(0, 80));
    setDisplay({ tone: item.ok ? "ok" : "err", number: item.title, client: item.client ?? "", line: item.detail });
  }

  function submit(raw: string) {
    const text = raw.trim();
    setCode("");
    if (!text || !action) return;
    if (last.current && last.current.code === text && Date.now() - last.current.at < 2000) return;
    last.current = { code: text, at: Date.now() };
    const stock = text.toUpperCase().match(/LN-[A-Z2-9]{10}/)?.[0];
    if (stock && isPublicCode(stock)) { router.push(`/estoque/codigo/${stock}`); return; }
    const chosen = action;
    setDisplay({ tone: "busy", number: text, client: "", line: "Consultando…" });
    start(async () => {
      try {
        const found = await findOrder(text);
        if (!found.order) { push({ ok: false, code: text, action: chosen, title: text, detail: found.error ?? "Não encontrada." }); return; }
        const order = found.order;
        const number = visible(order);
        const block = scanBlockReason(chosen, { status: order.status, medicalRequired: order.medical_review_required, medicalApproved: order.medical_review_approved_at }, (status) => STATUS_LABEL[status as OrderStatus] ?? status);
        if (block) { push({ ok: false, code: text, action: chosen, id: order.id, title: number, client: order.client_name, detail: `Não registrado. ${block}` }); return; }
        const result = await run(chosen, order);
        push({ ok: Boolean(result?.ok), code: text, action: chosen, id: order.id, title: number, client: order.client_name, detail: result?.ok ? (chosen === "lente" ? result.message ?? DONE[chosen] : DONE[chosen]) : result?.message ?? "Não foi possível registrar." });
        if (result?.ok) void loadRadar();
      } catch {
        push({ ok: false, code: text, action: chosen, title: text, detail: "Falha na conexão. Bipe de novo." });
      } finally {
        input.current?.focus();
      }
    });
  }

  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch { /* navegador sem tela cheia */ }
    input.current?.focus();
  }

  if (!action) return <p className="text-sm">Seu perfil não movimenta OS pelo bipe.</p>;
  const okCount = log.filter((item) => item.ok).length;
  const groups = radar ? radarGroups(radar, now) : null;
  const Icon = ICONS[action];

  return (
    <div ref={root} className={`pdv${full ? " is-full" : ""}`} onClick={(event) => { if (!(event.target as HTMLElement).closest("input, button, a, select")) input.current?.focus(); }}>
      <div className="pdv-main">
        <header className="pdv-head">
          <div>
            <h1>{embedded ? "Bipar" : "Caixa da produção"}</h1>
            <p>Escolha a ação (F1 a F5) e passe o leitor. Um bipe, uma OS registrada.</p>
          </div>
          <button type="button" className="pdv-tool" onClick={() => setCamera((value) => !value)} aria-pressed={camera}>{camera ? <CameraOff size={16} /> : <Camera size={16} />}Câmera</button>
          {embedded ? null : <button type="button" className="pdv-tool" onClick={toggleFull}>{full ? <Shrink size={16} /> : <Expand size={16} />}{full ? "Sair da tela cheia" : "Tela cheia"}</button>}
        </header>

        <section className={`pdv-lcd is-${display.tone} is-${action}`} aria-live="polite">
          <div className="pdv-lcd-mode"><Icon size={18} aria-hidden /><span>{SCAN_ACTIONS[action].label}</span><kbd>{KEYS[action]}</kbd></div>
          {display.tone === "idle" ? (
            <p className="pdv-lcd-big is-wait">Aguardando bipe</p>
          ) : (
            <>
              <p className="pdv-lcd-big">{display.number}</p>
              {display.client ? <p className="pdv-lcd-client">{display.client}</p> : null}
              <p className="pdv-lcd-line">{display.tone === "ok" ? <Check size={18} aria-hidden /> : display.tone === "err" ? <X size={18} aria-hidden /> : null}{display.line}</p>
            </>
          )}
          <form className="pdv-slot" onSubmit={(event) => { event.preventDefault(); submit(code); }}>
            <ScanLine size={22} aria-hidden />
            <input ref={input} value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-label="Código da OS" placeholder="Bipe a etiqueta ou digite o nº da OS" />
            <button type="submit" disabled={pending || !code.trim()}>Registrar</button>
          </form>
        </section>
        {camera ? <CameraReader onCode={submit} /> : null}

        <div className="pdv-keys" role="radiogroup" aria-label="Ação do bipe">
          {actions.map((key) => {
            const KeyIcon = ICONS[key];
            return (
              <button key={key} type="button" role="radio" aria-checked={action === key} onClick={() => setAction(key)} className={`pdv-key is-${key}`}>
                <kbd>{KEYS[key]}</kbd>
                <KeyIcon size={24} aria-hidden />
                <b>{SCAN_ACTIONS[key].label}</b>
                <small>{SCAN_ACTIONS[key].hint}</small>
              </button>
            );
          })}
        </div>

        <section className="pdv-radar" aria-label="Prazos que pedem cuidado">
          <div className="pdv-radar-head">
            <h2>Radar de prazos</h2>
            <p>{groups ? <>Atualizado às {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Clique com o botão direito numa OS para agir.</> : "Carregando as OS abertas…"}</p>
          </div>
          {groups ? (
            <>
              <div className="pdv-flow">
                {(["aguardando_lentes", "aguardando_montagem", "em_montagem", "em_conferencia", "pronto"] as OrderStatus[]).map((status) => (
                  <span key={status}><b>{groups.counts[status] ?? 0}</b>{STATUS_LABEL[status]}</span>
                ))}
              </div>
              <div className="pdv-lanes">
                <RadarColumn lane="atrasada" title="Atrasadas" empty="Nenhuma atrasada. Bom trabalho." items={groups.lanes.atrasada} now={now} />
                <RadarColumn lane="risco" title="Vão atrasar" empty="Nenhuma com prazo estourando." items={groups.lanes.risco} now={now} />
                <RadarColumn lane="atencao" title="Folga curta" empty="Nenhuma com folga apertada." items={groups.lanes.atencao} now={now} />
              </div>
            </>
          ) : null}
        </section>
      </div>

      <aside className="pdv-receipt" aria-label="Cupom do turno">
        <div className="pdv-paper">
          <p className="pdv-paper-title">Lab Gold · cupom do turno</p>
          <p className="pdv-paper-sub">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
          <hr />
          {log.length === 0 ? <p className="pdv-paper-empty">Nenhum bipe ainda. Cada OS registrada aparece aqui.</p> : null}
          <ol>
            {log.map((item) => (
              <li key={item.key} className={item.ok ? "is-ok" : "is-err"} data-os-id={item.id}>
                <span className="pdv-line-top"><time>{item.at}</time><b>{item.title}</b><em>{item.ok ? "OK" : "RECUSADO"}</em></span>
                <span className="pdv-line-sub">{SCAN_ACTIONS[item.action].label}{item.client ? ` · ${item.client}` : ""}</span>
                {!item.ok ? <span className="pdv-line-why">{item.detail}</span> : null}
                {item.id ? <Link href={`/laboratorio/${item.id}`} className="pdv-line-open">Abrir</Link> : null}
              </li>
            ))}
          </ol>
          <hr />
          <p className="pdv-total"><span>Registradas</span><b>{okCount}</b></p>
          <p className="pdv-total is-muted"><span>Recusadas</span><b>{log.length - okCount}</b></p>
          {log.length ? <button type="button" className="pdv-tear" onClick={() => { setLog([]); setDisplay({ tone: "idle", number: "", client: "", line: "" }); input.current?.focus(); }}>Novo cupom</button> : null}
        </div>
      </aside>
    </div>
  );
}

function RadarColumn({ lane, title, empty, items, now }: { lane: RadarLane; title: string; empty: string; items: { order: RadarOrder; reason: string }[]; now: Date }) {
  const shown = items.slice(0, 8);
  return (
    <div className={`pdv-lane is-${lane}`}>
      <h3><span>{title}</span><b>{items.length}</b></h3>
      {shown.length === 0 ? <p className="pdv-lane-empty">{empty}</p> : null}
      <ul>
        {shown.map(({ order, reason }) => (
          <li key={order.id} data-os-id={order.id}>
            <Link href={`/laboratorio/${order.id}`}>
              <span className="pdv-os">{visible(order)}</span>
              <span className="pdv-when">{deadlineText(order.due_at, now)}</span>
              <span className="pdv-who">{order.client_name}</span>
              <span className="pdv-stage">{STATUS_LABEL[order.status]}{lane === "atrasada" ? "" : ` · ${reason}`}</span>
            </Link>
          </li>
        ))}
      </ul>
      {items.length > shown.length ? <Link className="pdv-lane-more" href="/laboratorio?tab=atrasadas">Mais {items.length - shown.length} na fila de produção</Link> : null}
    </div>
  );
}

/** Leitura pela câmera (celular/tablet): código de barras ou QR. */
function CameraReader({ onCode }: { onCode: (text: string) => void }) {
  const [state, setState] = useState("Abrindo câmera…");
  const handler = useRef(onCode);
  useEffect(() => { handler.current = onCode; }, [onCode]);
  useEffect(() => {
    let scanner: { stop: () => Promise<void> } | null = null;
    let active = true;
    void (async () => {
      try {
        if (!window.isSecureContext) { setState("A câmera precisa de HTTPS."); return; }
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!active) return;
        const instance = new Html5Qrcode("sc-camera", { formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
        scanner = instance;
        await instance.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 280, height: 140 } }, (text) => handler.current(text), () => undefined);
        setState("Aponte para o código.");
      } catch { setState("Não foi possível abrir a câmera. Use o leitor ou digite o número."); }
    })();
    return () => { active = false; void scanner?.stop().catch(() => undefined); };
  }, []);
  return <div className="sc-camera"><div id="sc-camera" /><p className="text-sm text-[var(--muted)]">{state}</p></div>;
}
