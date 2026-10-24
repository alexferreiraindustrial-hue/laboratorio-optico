"use client";

import { ArrowRight, Check, Keyboard, PackageCheck, PackageOpen, Printer, ScanLine, Trash2, X, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { STATUS_LABEL, type AppRole, type OrderStatus } from "@/lib/domain/constants";
import { can } from "@/lib/domain/permissions";
import { parseQuickBatch, parseQuickEntry, type QuickEntry } from "@/lib/domain/quick-entry";
import type { Laboratory, Seller, SellerStoreLink, Store } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  findOrdersForQuick,
  quickCreateOrders,
  quickMoveOrders,
  type FoundOrder,
  type QuickCreateResult,
} from "@/server/quick-actions";
import { StatusBadge } from "./status-badge";
import { Button, Panel } from "./ui";

type Mode = "entrada" | "lentes" | "saida";

const MODES: { key: Mode; label: string; hint: string; icon: typeof Zap }[] = [
  { key: "entrada", label: "Entrada de OS", hint: "Abre OS só com número, só com nome ou com os dois.", icon: Zap },
  { key: "lentes", label: "Chegada de lentes", hint: "Libera para a montagem as OS cujas lentes chegaram.", icon: PackageOpen },
  { key: "saida", label: "Saída / entrega", hint: "Registra a retirada das OS prontas.", icon: PackageCheck },
];

const DUE_OPTIONS: { label: string; hours: number | null }[] = [
  { label: "24 h", hours: 24 },
  { label: "48 h", hours: 48 },
  { label: "72 h", hours: 72 },
  { label: "5 dias", hours: 120 },
  { label: "Sem prazo", hours: null },
];

type Draft = QuickEntry & { key: string; result?: QuickCreateResult };

function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.25));
  } catch {
    /* sem áudio, sem problema */
  }
}

function readPrefs() {
  try {
    return JSON.parse(window.localStorage.getItem("quick-launch-prefs") ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function savePrefs(value: Record<string, string>) {
  try {
    window.localStorage.setItem("quick-launch-prefs", JSON.stringify(value));
  } catch {
    /* navegador sem armazenamento */
  }
}

export function QuickLaunch({
  role,
  laboratories,
  sellers,
  stores,
  sellerLinks,
  initialMode,
}: {
  role: AppRole;
  laboratories: Laboratory[];
  sellers: Seller[];
  stores: Store[];
  sellerLinks: SellerStoreLink[];
  initialMode: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const allowed: Record<Mode, boolean> = {
    entrada: can(role, "orders.write"),
    lentes: can(role, "orders.status"),
    saida: can(role, "orders.deliver"),
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-2.5 sm:grid-cols-3">
        {MODES.map((item) => {
          const on = item.key === mode;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors",
                on ? "border-[#0e6b62] bg-[#e4f1ef] shadow-[0_0_0_3px_rgba(14,107,98,0.12)]" : "border-[#e2e7e9] bg-white hover:border-[#cdd5d8]",
              )}
            >
              <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", on ? "bg-[#0e6b62] text-white" : "bg-[#eef1f3] text-[#44524f]")}>
                <Icon size={17} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-xs text-[#6e7c7a]">{item.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {!allowed[mode] ? (
        <Panel className="px-5 py-8 text-center text-sm text-[#6e7c7a]">
          {mode === "saida"
            ? "A saída (entrega) é registrada por gestor ou administrador."
            : "Seu perfil não tem permissão para esta operação."}
        </Panel>
      ) : mode === "entrada" ? (
        <EntryMode laboratories={laboratories} sellers={sellers} stores={stores} sellerLinks={sellerLinks} />
      ) : (
        <MoveMode key={mode} mode={mode} />
      )}
    </div>
  );
}

function EntryMode({
  laboratories,
  sellers,
  stores,
  sellerLinks,
}: {
  laboratories: Laboratory[];
  sellers: Seller[];
  stores: Store[];
  sellerLinks: SellerStoreLink[];
}) {
  const activeLabs = laboratories.filter((lab) => lab.active);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [labId, setLabId] = useState(activeLabs[0]?.id ?? "");
  const [sellerId, setSellerId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [dueHours, setDueHours] = useState<number | null>(48);
  const [status, setStatus] = useState<"aguardando_lentes" | "aguardando_montagem">("aguardando_lentes");
  const [urgent, setUrgent] = useState(false);
  const [instant, setInstant] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const prefs = readPrefs();
    /* eslint-disable react-hooks/set-state-in-effect -- restaura preferências salvas no navegador */
    if (prefs.labId && activeLabs.some((lab) => lab.id === prefs.labId)) setLabId(prefs.labId);
    if (prefs.sellerId && sellers.some((seller) => seller.id === prefs.sellerId)) setSellerId(prefs.sellerId);
    if (prefs.storeId && stores.some((store) => store.id === prefs.storeId)) setStoreId(prefs.storeId);
    if (prefs.dueHours) setDueHours(prefs.dueHours === "none" ? null : Number(prefs.dueHours));
    if (prefs.status === "aguardando_montagem") setStatus("aguardando_montagem");
    if (prefs.instant === "1") setInstant(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    savePrefs({ labId, sellerId, storeId, dueHours: dueHours == null ? "none" : String(dueHours), status, instant: instant ? "1" : "0" });
  }, [labId, sellerId, storeId, dueHours, status, instant]);

  const visibleSellers = useMemo(() => {
    const active = sellers.filter((seller) => seller.active);
    if (!storeId) return active;
    const allowedIds = new Set(sellerLinks.filter((link) => link.store_id === storeId).map((link) => link.seller_id));
    return active.filter((seller) => allowedIds.has(seller.id));
  }, [sellers, sellerLinks, storeId]);

  const pendingDrafts = drafts.filter((item) => !item.result?.ok);
  const createdIds = drafts.filter((item) => item.result?.ok && item.result.id).map((item) => item.result!.id!);

  function launch(list: Draft[]) {
    const targets = list.filter((item) => !item.result?.ok);
    if (targets.length === 0 || !labId) return;
    startTransition(async () => {
      const response = await quickCreateOrders({
        entries: targets.map((item) => ({ orderRef: item.orderRef, clientName: item.clientName })),
        laboratoryId: labId,
        sellerId: sellerId || null,
        storeId: storeId || null,
        dueHours,
        status,
        priority: urgent ? "critica" : "normal",
      });
      if (response.results.length === 0) {
        setMessage(response.message ?? "Não foi possível lançar.");
        beep(false);
        return;
      }
      const byKey = new Map(targets.map((item, index) => [item.key, response.results.find((result) => result.index === index)]));
      setDrafts((current) => current.map((item) => (byKey.has(item.key) ? { ...item, result: byKey.get(item.key) } : item)));
      setMessage(response.message ?? null);
      beep(response.results.every((item) => item.ok));
      inputRef.current?.focus();
    });
  }

  function addFromText(value: string) {
    const entries = value.includes("\n") || value.includes(";") ? parseQuickBatch(value) : [parseQuickEntry(value)].filter(Boolean) as QuickEntry[];
    const fresh: Draft[] = entries
      .filter((entry) => entry.orderRef || entry.clientName)
      .map((entry) => ({ ...entry, key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }));
    if (fresh.length === 0) return;
    setText("");
    setMessage(null);
    if (instant) {
      setDrafts((current) => [...fresh, ...current]);
      launch(fresh);
    } else {
      setDrafts((current) => [...fresh, ...current]);
      beep(true);
    }
  }

  if (activeLabs.length === 0) {
    return <Panel className="px-5 py-8 text-center text-sm text-[#6e7c7a]">Cadastre um laboratório em Configurações antes de lançar OS.</Panel>;
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-5">
        <Panel className="p-5">
          <label className="text-[13px] font-semibold text-[#44524f]" htmlFor="quick-input">
            Digite ou bipe: <span className="font-normal text-[#6e7c7a]">“4521 Maria Souza”, só “4521” ou só “Maria Souza”</span>
          </label>
          <div className="mt-2.5 flex items-stretch gap-2.5">
            <div className="flex flex-1 items-start gap-2.5 rounded-xl border-2 border-[#0e6b62] bg-white px-3.5 py-3 shadow-[0_0_0_4px_rgba(14,107,98,0.10)]">
              <ScanLine size={22} className="mt-0.5 shrink-0 text-[#0e6b62]" />
              <textarea
                id="quick-input"
                ref={inputRef}
                rows={1}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onPaste={(event) => {
                  const pasted = event.clipboardData.getData("text");
                  if (pasted.includes("\n")) {
                    event.preventDefault();
                    addFromText(pasted);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    if (text.trim()) addFromText(text);
                    launch(drafts);
                    return;
                  }
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    addFromText(text);
                  }
                  if (event.key === "Escape") setText("");
                }}
                placeholder="Número da OS e/ou nome do cliente"
                className="min-h-7 flex-1 resize-none border-0 bg-transparent text-lg font-medium text-[#13201f] shadow-none outline-none placeholder:font-normal placeholder:text-[#8a9694] focus:shadow-none"
              />
            </div>
            <Button type="button" className="h-auto px-5" disabled={!text.trim()} onClick={() => addFromText(text)}>
              Adicionar
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#6e7c7a]">
            <span className="flex items-center gap-1.5"><Keyboard size={14} /> Enter adiciona · Ctrl+Enter lança tudo · cole uma lista para lançar em lote</span>
            <label className="flex cursor-pointer items-center gap-1.5 font-medium text-[#44524f]">
              <input type="checkbox" checked={instant} onChange={(event) => setInstant(event.target.checked)} className="accent-[#0e6b62]" />
              Lançar direto ao apertar Enter (modo leitor)
            </label>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#e2e7e9] px-5 py-3.5">
            <h2 className="text-[15px] font-semibold">
              Fila de lançamento <span className="ml-1 rounded-md bg-[#eef1f3] px-1.5 text-xs text-[#6e7c7a]">{drafts.length}</span>
            </h2>
            <div className="flex items-center gap-2">
              {drafts.length > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setDrafts([]); setMessage(null); inputRef.current?.focus(); }}>
                  Limpar
                </Button>
              ) : null}
              <Button type="button" disabled={pending || pendingDrafts.length === 0} onClick={() => launch(drafts)}>
                <Zap size={16} />
                {pending ? "Lançando..." : `Lançar ${pendingDrafts.length || ""} OS`}
              </Button>
            </div>
          </div>
          {drafts.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#8a9694]">As OS digitadas aparecem aqui antes de serem abertas.</p>
          ) : (
            <ul>
              {drafts.map((item) => (
                <li key={item.key} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#eef1f3] px-5 py-2.5 last:border-b-0">
                  <input
                    value={item.orderRef ?? ""}
                    disabled={item.result?.ok}
                    placeholder="Sem nº"
                    onChange={(event) => setDrafts((current) => current.map((d) => (d.key === item.key ? { ...d, orderRef: event.target.value || null, result: undefined } : d)))}
                    className="h-8 rounded-md border border-transparent bg-[#f7f9f9] px-2 font-mono text-[13px] outline-none focus:border-[#0e6b62] disabled:bg-transparent"
                  />
                  <input
                    value={item.clientName ?? ""}
                    disabled={item.result?.ok}
                    placeholder={item.orderRef ? `OS ${item.orderRef} (completar nome depois)` : "Nome do cliente"}
                    onChange={(event) => setDrafts((current) => current.map((d) => (d.key === item.key ? { ...d, clientName: event.target.value || null, result: undefined } : d)))}
                    className="h-8 min-w-0 rounded-md border border-transparent bg-[#f7f9f9] px-2 text-sm font-medium outline-none focus:border-[#0e6b62] disabled:bg-transparent"
                  />
                  <div className="flex items-center justify-end gap-2">
                    {item.result ? (
                      item.result.ok ? (
                        <Link href={`/laboratorio/${item.result.id}`} className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#e3f4ea] px-2 py-1 font-mono text-xs font-semibold text-[#1c6b43]">
                          <Check size={13} /> {item.result.number}
                        </Link>
                      ) : (
                        <span className="max-w-[220px] truncate rounded-md bg-[#fdecea] px-2 py-1 text-xs font-semibold text-[#a3261b]" title={item.result.message}>
                          {item.result.message}
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-[#8a9694]">pronta p/ lançar</span>
                    )}
                    {!item.result?.ok ? (
                      <button type="button" aria-label="Remover" className="rounded-md p-1.5 text-[#8a9694] hover:bg-[#f2f4f5] hover:text-[#b42318]" onClick={() => setDrafts((current) => current.filter((d) => d.key !== item.key))}>
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {message || createdIds.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e7e9] bg-[#f7f9f9] px-5 py-3 text-[13px]">
              <span className="font-medium text-[#44524f]">{message}</span>
              {createdIds.length > 0 ? (
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/laboratorio/etiquetas?ids=${createdIds.join(",")}`}>
                    <Printer size={14} /> Imprimir etiquetas ({createdIds.length})
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel className="flex flex-col gap-4 p-5">
        <h2 className="text-[15px] font-semibold">Padrões do lançamento</h2>
        <p className="-mt-2 text-xs text-[#6e7c7a]">Aplicados a todas as OS da fila. Ficam salvos neste computador.</p>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#44524f]">
          Laboratório
          <select value={labId} onChange={(event) => setLabId(event.target.value)} className="h-9 rounded-lg border border-[#cdd5d8] bg-white px-2.5 text-sm text-[#13201f] outline-none focus:border-[#0e6b62]">
            {activeLabs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#44524f]">
          Loja
          <select value={storeId} onChange={(event) => { setStoreId(event.target.value); setSellerId(""); }} className="h-9 rounded-lg border border-[#cdd5d8] bg-white px-2.5 text-sm text-[#13201f] outline-none focus:border-[#0e6b62]">
            <option value="">Não informada</option>
            {stores.filter((store) => store.active).map((store) => <option key={store.id} value={store.id}>{store.trade_name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#44524f]">
          Vendedor <span className="-mt-1 text-[11px] font-normal text-[#8a9694]">Ele acompanha estas OS pelo link dele</span>
          <select value={sellerId} onChange={(event) => setSellerId(event.target.value)} className="h-9 rounded-lg border border-[#cdd5d8] bg-white px-2.5 text-sm text-[#13201f] outline-none focus:border-[#0e6b62]">
            <option value="">Não informado</option>
            {visibleSellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
          </select>
        </label>
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium text-[#44524f]">Prazo a partir de agora</span>
          <div className="flex flex-wrap gap-1.5">
            {DUE_OPTIONS.map((option) => (
              <Chip key={option.label} on={dueHours === option.hours} onClick={() => setDueHours(option.hours)}>{option.label}</Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium text-[#44524f]">Situação inicial</span>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={status === "aguardando_lentes"} onClick={() => setStatus("aguardando_lentes")}>Aguardando lentes</Chip>
            <Chip on={status === "aguardando_montagem"} onClick={() => setStatus("aguardando_montagem")}>Lentes já na bancada</Chip>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e2e7e9] px-3 py-2.5 text-[13px] font-medium">
          <input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} className="accent-[#b42318]" />
          Marcar como urgente
        </label>
        <p className="rounded-lg bg-[#f7f9f9] px-3 py-2.5 text-xs text-[#6e7c7a]">
          OS lançadas aqui entram com a descrição “Lançamento rápido”. Complete grau e armação quando quiser, em Editar dados.
        </p>
      </Panel>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-lg border px-3 text-[13px] font-semibold transition-colors",
        on ? "border-[#0e6b62] bg-[#0e6b62] text-white" : "border-[#cdd5d8] bg-white text-[#44524f] hover:bg-[#f7f9f9]",
      )}
    >
      {children}
    </button>
  );
}

type Picked = FoundOrder & { result?: { ok: boolean; message: string } };

function MoveMode({ mode }: { mode: "lentes" | "saida" }) {
  const required: OrderStatus = mode === "lentes" ? "aguardando_lentes" : "pronto";
  const target = mode === "lentes" ? "aguardando_montagem" : "entregue";
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [choices, setChoices] = useState<FoundOrder[]>([]);
  const [pickupBy, setPickupBy] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [searching, startSearch] = useTransition();

  useEffect(() => inputRef.current?.focus(), []);

  const valid = picked.filter((item) => item.status === required && !item.result?.ok);

  function add(order: FoundOrder) {
    setChoices([]);
    setQuery("");
    if (picked.some((item) => item.id === order.id)) {
      setMessage(`${order.number} já está na lista.`);
      beep(false);
      return;
    }
    setPicked((current) => [order, ...current]);
    setMessage(order.status === required ? null : `${order.number} está em “${STATUS_LABEL[order.status]}”.`);
    beep(order.status === required);
    inputRef.current?.focus();
  }

  function search(value: string) {
    if (!value.trim()) return;
    startSearch(async () => {
      const response = await findOrdersForQuick(value);
      if (!response.ok || response.orders.length === 0) {
        setMessage(response.message ?? "Nada encontrado.");
        setChoices([]);
        beep(false);
        return;
      }
      if (response.orders.length === 1) add(response.orders[0]);
      else {
        const preferred = response.orders.filter((order) => order.status === required);
        if (preferred.length === 1) add(preferred[0]);
        else {
          setChoices(response.orders);
          setMessage("Mais de uma OS encontrada. Escolha:");
        }
      }
    });
  }

  function confirm() {
    if (valid.length === 0) return;
    const note =
      mode === "saida"
        ? `Saída rápida${pickupBy.trim() ? ` · retirado por ${pickupBy.trim()}` : ""}`
        : "Lentes recebidas (lançamento rápido)";
    startTransition(async () => {
      const response = await quickMoveOrders(valid.map((item) => item.id), target, note);
      const byId = new Map(response.results.map((result) => [result.id, result]));
      setPicked((current) => current.map((item) => (byId.has(item.id) ? { ...item, result: byId.get(item.id) } : item)));
      setMessage(response.message);
      beep(response.ok);
      inputRef.current?.focus();
    });
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-5">
        <Panel className="p-5">
          <label className="text-[13px] font-semibold text-[#44524f]" htmlFor="move-input">
            Bipe a etiqueta ou digite o número da OS <span className="font-normal text-[#6e7c7a]">(do sistema, da ótica ou o nome)</span>
          </label>
          <form
            className="mt-2.5 flex items-stretch gap-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              search(query);
            }}
          >
            <div className="flex flex-1 items-center gap-2.5 rounded-xl border-2 border-[#0e6b62] bg-white px-3.5 py-3 shadow-[0_0_0_4px_rgba(14,107,98,0.10)]">
              <ScanLine size={22} className="shrink-0 text-[#0e6b62]" />
              <input
                id="move-input"
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={mode === "saida" ? "OS que está saindo" : "OS cujas lentes chegaram"}
                className="min-w-0 flex-1 border-0 bg-transparent text-lg font-medium shadow-none outline-none placeholder:font-normal placeholder:text-[#8a9694] focus:shadow-none"
              />
            </div>
            <Button type="submit" className="h-auto px-5" disabled={searching || !query.trim()}>
              {searching ? "Buscando..." : "Buscar"}
            </Button>
          </form>
          {message ? <p className="mt-3 text-[13px] font-medium text-[#44524f]">{message}</p> : null}
          {choices.length > 0 ? (
            <div className="mt-2 flex flex-col gap-1.5">
              {choices.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => add(order)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e7e9] px-3 py-2 text-left hover:border-[#0e6b62] hover:bg-[#f7f9f9]"
                >
                  <span className="flex flex-col">
                    <span className="font-mono text-[13px] font-medium text-[#0e6b62]">{order.number}{order.external_order_id ? ` · ótica ${order.external_order_id}` : ""}</span>
                    <span className="text-sm font-semibold">{order.client_name}</span>
                  </span>
                  <StatusBadge status={order.status} />
                </button>
              ))}
            </div>
          ) : null}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#e2e7e9] px-5 py-3.5">
            <h2 className="text-[15px] font-semibold">
              {mode === "saida" ? "OS para dar saída" : "OS com lentes recebidas"}
              <span className="ml-2 rounded-md bg-[#eef1f3] px-1.5 text-xs text-[#6e7c7a]">{picked.length}</span>
            </h2>
            {picked.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setPicked([]); setMessage(null); }}>Limpar</Button>
            ) : null}
          </div>
          {picked.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#8a9694]">Cada OS lida entra aqui para conferência.</p>
          ) : (
            <ul>
              {picked.map((item) => {
                const ok = item.status === required;
                return (
                  <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#eef1f3] px-5 py-3 last:border-b-0">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-mono text-[13px] font-medium text-[#0e6b62]">
                        {item.number}
                        {item.external_order_id ? <span className="text-[#6e7c7a]"> · ótica {item.external_order_id}</span> : null}
                      </span>
                      <span className="truncate text-sm font-semibold">{item.client_name}</span>
                      <span className="truncate text-xs text-[#6e7c7a]">{item.store_name || "—"} · {item.seller_name || "Sem vendedor"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.result ? (
                        <span className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold", item.result.ok ? "bg-[#e3f4ea] text-[#1c6b43]" : "bg-[#fdecea] text-[#a3261b]")}>
                          {item.result.ok ? <><Check size={13} /> {mode === "saida" ? "Entregue" : "Liberada p/ montagem"}</> : item.result.message}
                        </span>
                      ) : ok ? (
                        <StatusBadge status={item.status} />
                      ) : (
                        <span className="rounded-md bg-[#fdf3dc] px-2 py-1 text-xs font-semibold text-[#8a5a00]">
                          Está em “{STATUS_LABEL[item.status]}”
                        </span>
                      )}
                      {!item.result?.ok ? (
                        <button type="button" aria-label="Remover" className="rounded-md p-1.5 text-[#8a9694] hover:bg-[#f2f4f5] hover:text-[#b42318]" onClick={() => setPicked((current) => current.filter((p) => p.id !== item.id))}>
                          <X size={15} />
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="flex flex-col gap-4 p-5">
        <h2 className="text-[15px] font-semibold">{mode === "saida" ? "Confirmar saída" : "Liberar para montagem"}</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg bg-[#e3f4ea] px-3 py-2.5">
            <p className="text-xs font-semibold text-[#1c6b43]">Prontas</p>
            <p className="tabular text-2xl font-semibold text-[#1c6b43]">{valid.length}</p>
          </div>
          <div className="rounded-lg bg-[#fdf3dc] px-3 py-2.5">
            <p className="text-xs font-semibold text-[#8a5a00]">Bloqueadas</p>
            <p className="tabular text-2xl font-semibold text-[#8a5a00]">{picked.filter((item) => item.status !== required && !item.result?.ok).length}</p>
          </div>
        </div>
        {mode === "saida" ? (
          <label className="grid gap-1.5 text-[13px] font-medium text-[#44524f]">
            Retirado por <span className="-mt-1 text-[11px] font-normal text-[#8a9694]">Opcional — vai para o histórico</span>
            <input value={pickupBy} onChange={(event) => setPickupBy(event.target.value)} placeholder="Motoboy, vendedor, cliente..." className="h-9 rounded-lg border border-[#cdd5d8] bg-white px-3 text-sm outline-none focus:border-[#0e6b62]" />
          </label>
        ) : (
          <p className="text-xs text-[#6e7c7a]">Só OS em “Aguardando lentes” são liberadas. A montagem passa a vê-las na fila dela.</p>
        )}
        <Button type="button" className="h-11 text-[15px]" disabled={pending || valid.length === 0} onClick={confirm}>
          {pending ? "Registrando..." : mode === "saida" ? `Dar saída em ${valid.length} OS` : `Liberar ${valid.length} OS`}
          <ArrowRight size={16} />
        </Button>
        {mode === "saida" ? (
          <p className="text-xs text-[#6e7c7a]">Só OS “Prontas” saem. O vendedor vê “Entregue” no acompanhamento dele na hora.</p>
        ) : null}
      </Panel>
    </div>
  );
}
