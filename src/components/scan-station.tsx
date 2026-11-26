"use client";
// Modo bipe: escolhe a ação uma vez e bipa as OS uma atrás da outra.
// Cada bipe usa uma ação que o sistema já tinha (mesmas regras e histórico de sempre).
import { Camera, CameraOff, Check, PackageCheck, PackageOpen, ScanLine, Stethoscope, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isPublicCode } from "@/lib/domain/qr";
import { useEffect, useRef, useState, useTransition } from "react";
import { STATUS_LABEL, type AppRole, type OrderStatus } from "@/lib/domain/constants";
import { can } from "@/lib/domain/permissions";
import { parseScanCode, SCAN_ACTIONS, scanBlockReason, type ScanAction } from "@/lib/domain/scan";
import { createClient } from "@/lib/supabase/client";
import { changeOrderStatus } from "@/server/actions";
import { confirmClientDelivery } from "@/server/fast-operations-actions";
import { approveMedicalReview } from "@/server/followup-actions";
import { quickMoveOrders } from "@/server/quick-actions";

const ICONS: Record<ScanAction, typeof Check> = { lente: PackageOpen, pronto: Check, medico: Stethoscope, voltou: Undo2, entregue: PackageCheck };
const ORDER: ScanAction[] = ["lente", "pronto", "medico", "voltou", "entregue"];

type Found = { id: string; number: string; external_order_id: string | null; client_name: string; status: string; medical_review_required: boolean | null; medical_review_approved_at: string | null; updated_at: string };
type LogItem = { key: number; at: string; code: string; ok: boolean; title: string; detail: string; id?: string };

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
      return { ok: Boolean(item?.ok), message: item?.ok ? (item.waitingFrame ? "Lente recebida. VTA: aguardando armação." : "Lente recebida · foi para a bancada.") : item?.message ?? result.message };
    }
    case "pronto": return changeOrderStatus(order.id, "pronto", "Bipe: ficou pronto");
    case "medico": return changeOrderStatus(order.id, "em_conferencia", "Bipe: foi para o médico");
    case "voltou": return approveMedicalReview(order.id, "Bipe: voltou do médico, conferido e liberado", order.updated_at);
    case "entregue": return confirmClientDelivery(order.id, "", new Date().toISOString());
  }
}

export function ScanStation({ role }: { role: AppRole }) {
  const router = useRouter();
  const actions = allowedScanActions(role);
  const [action, setAction] = useState<ScanAction | null>(actions[0] ?? null);
  const [code, setCode] = useState("");
  const [log, setLog] = useState<LogItem[]>([]);
  const [pending, start] = useTransition();
  const [camera, setCamera] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const last = useRef<{ code: string; at: number } | null>(null);

  useEffect(() => { input.current?.focus(); }, [action]);

  function push(item: Omit<LogItem, "key" | "at">) {
    beep(item.ok);
    setLog((current) => [{ ...item, key: ++seq.current, at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }, ...current].slice(0, 60));
  }

  function submit(raw: string) {
    const text = raw.trim();
    setCode("");
    if (!text || !action) return;
    // Leitores às vezes repetem o mesmo código; ignora o repetido em menos de 2 segundos.
    if (last.current && last.current.code === text && Date.now() - last.current.at < 2000) return;
    last.current = { code: text, at: Date.now() };
    // Etiqueta de estoque (LN-...) bipada aqui: abre o item de estoque.
    const stock = text.toUpperCase().match(/LN-[A-Z2-9]{10}/)?.[0];
    if (stock && isPublicCode(stock)) { router.push(`/estoque/codigo/${stock}`); return; }
    start(async () => {
      try {
        const found = await findOrder(text);
        if (!found.order) { push({ ok: false, code: text, title: text, detail: found.error ?? "Não encontrada." }); return; }
        const order = found.order;
        const number = order.external_order_id && order.external_order_id !== order.number ? order.external_order_id : order.number;
        const block = scanBlockReason(action, { status: order.status, medicalRequired: order.medical_review_required, medicalApproved: order.medical_review_approved_at }, (status) => STATUS_LABEL[status as OrderStatus] ?? status);
        if (block) { push({ ok: false, code: text, id: order.id, title: `${number} · ${order.client_name}`, detail: `Não foi: ${block}` }); return; }
        const result = await run(action, order);
        push({ ok: Boolean(result?.ok), code: text, id: order.id, title: `${number} · ${order.client_name}`, detail: result?.ok ? (action === "lente" ? result.message ?? "" : SCAN_ACTIONS[action].label) : result?.message ?? "Não foi possível." });
      } catch {
        push({ ok: false, code: text, title: text, detail: "Falha na conexão. Bipe de novo." });
      } finally {
        input.current?.focus();
      }
    });
  }

  const okCount = log.filter((item) => item.ok).length;
  if (!action) return <p className="text-sm">Seu perfil não movimenta OS pelo bipe.</p>;
  return (
    <div className="sc-station">
      <div className="sc-actions" role="radiogroup" aria-label="O que o bipe vai registrar">
        {actions.map((key) => {
          const Icon = ICONS[key];
          return (
            <button key={key} type="button" role="radio" aria-checked={action === key} onClick={() => setAction(key)} className={`sc-action is-${key}`}>
              <Icon size={22} /><b>{SCAN_ACTIONS[key].label}</b><small>{SCAN_ACTIONS[key].hint}</small>
            </button>
          );
        })}
      </div>

      <form className={`sc-input is-${action}`} onSubmit={(event) => { event.preventDefault(); submit(code); }}>
        <ScanLine size={26} aria-hidden />
        <label className="min-w-0 flex-1">
          <span className="sc-label">Bipe agora: <b>{SCAN_ACTIONS[action].label}</b></span>
          <input ref={input} value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text" placeholder="Passe o leitor no código de barras ou digite o nº da OS e Enter" aria-label="Código da OS" />
        </label>
        <button type="submit" className="ol-print" disabled={pending || !code.trim()}>{pending ? "…" : "Registrar"}</button>
        <button type="button" className="ocm-trigger" onClick={() => setCamera((value) => !value)} aria-pressed={camera} title="Ler com a câmera">{camera ? <CameraOff size={16} /> : <Camera size={16} />}<span className="hidden sm:inline">Câmera</span></button>
      </form>
      {camera ? <CameraReader onCode={submit} /> : null}

      <div className="sc-log">
        <p className="sc-log-head"><span>Bipados nesta tela</span><span><b>{okCount}</b> certo{okCount === 1 ? "" : "s"} · <b>{log.length - okCount}</b> com problema</span></p>
        {log.length === 0 ? <p className="sc-empty">Nada bipado ainda. O cursor fica no campo acima; é só passar o leitor.</p> : null}
        {log.map((item) => (
          <div key={item.key} className={`sc-item ${item.ok ? "is-ok" : "is-err"}`} data-os-id={item.id}>
            {item.ok ? <Check size={18} /> : <X size={18} />}
            <div className="min-w-0 flex-1"><b>{item.title}</b><p>{item.detail}</p></div>
            <time>{item.at}</time>
            {item.id ? <Link href={`/laboratorio/${item.id}`} className="text-xs font-semibold text-[var(--link)]">Abrir</Link> : null}
          </div>
        ))}
      </div>
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
