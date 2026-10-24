"use client";

import { CalendarClock, Check, Keyboard, PackageSearch, Printer, ScanLine, Store as StoreIcon, Trash2, User, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { dateTimeLocalToIso } from "@/lib/domain/calendar";
import { LENS_RISK, lensRisk, parseTargetCommand } from "@/lib/domain/flow";
import { parseQuickBatch, parseQuickEntry, type QuickEntry } from "@/lib/domain/quick-entry";
import type { Laboratory, Seller, SellerStoreLink, Store } from "@/lib/types";
import { cn } from "@/lib/utils";
import { quickCreateOrders, type QuickCreateResult } from "@/server/quick-actions";
import { Button, Panel } from "./ui";

type Draft = QuickEntry & {
  key: string;
  sellerId: string;
  storeId: string;
  dueAt: string | null;
  lensExpectedAt: string | null;
  lensSupplierRef: string;
  result?: QuickCreateResult;
};

const DUE_OPTIONS: { label: string; hours: number | null }[] = [
  { label: "24 h", hours: 24 },
  { label: "48 h", hours: 48 },
  { label: "72 h", hours: 72 },
  { label: "5 dias", hours: 120 },
  { label: "7 dias", hours: 168 },
];

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
    /* sem áudio */
  }
}

function readPrefs() {
  try {
    return JSON.parse(window.localStorage.getItem("quick-launch-prefs-v2") ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function savePrefs(value: Record<string, string>) {
  try {
    window.localStorage.setItem("quick-launch-prefs-v2", JSON.stringify(value));
  } catch {
    /* sem armazenamento */
  }
}

const shortDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmt = (iso: string | null) => (iso ? shortDate.format(new Date(iso)).replace(",", "") : "—");

function codeLabel(code?: number | null) {
  return code ? String(code) : "·";
}

export function EntryLaunch({
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
  const activeSellers = useMemo(() => sellers.filter((seller) => seller.active).sort((a, b) => (a.quick_code ?? 999) - (b.quick_code ?? 999)), [sellers]);
  const activeStores = useMemo(() => stores.filter((store) => store.active).sort((a, b) => (a.quick_code ?? 999) - (b.quick_code ?? 999)), [stores]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [labId, setLabId] = useState(activeLabs[0]?.id ?? "");
  const [sellerId, setSellerId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [dueHours, setDueHours] = useState<number | null>(48);
  const [dueDate, setDueDate] = useState("");
  const [lensDate, setLensDate] = useState("");
  const [lensRef, setLensRef] = useState("");
  const [status, setStatus] = useState<"aguardando_lentes" | "aguardando_montagem">("aguardando_lentes");
  const [urgent, setUrgent] = useState(false);
  const [instant, setInstant] = useState(true);
  const [pending, startTransition] = useTransition();
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    const prefs = readPrefs();
    /* eslint-disable react-hooks/set-state-in-effect -- restaura preferências salvas no navegador */
    if (prefs.labId && activeLabs.some((lab) => lab.id === prefs.labId)) setLabId(prefs.labId);
    if (prefs.dueHours) setDueHours(prefs.dueHours === "none" ? null : Number(prefs.dueHours));
    if (prefs.status === "aguardando_montagem") setStatus("aguardando_montagem");
    if (prefs.instant === "0") setInstant(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    savePrefs({ labId, dueHours: dueHours == null ? "none" : String(dueHours), status, instant: instant ? "1" : "0" });
  }, [labId, dueHours, status, instant]);

  const store = activeStores.find((item) => item.id === storeId) ?? null;
  const seller = activeSellers.find((item) => item.id === sellerId) ?? null;
  const storeSellerIds = useMemo(() => new Set(sellerLinks.filter((link) => link.store_id === storeId).map((link) => link.seller_id)), [sellerLinks, storeId]);
  const externalStore = Boolean(store && storeSellerIds.size === 0);
  const visibleSellers = store && !externalStore ? activeSellers.filter((item) => storeSellerIds.has(item.id)) : activeSellers;

  function currentDueIso(base: number) {
    if (dueDate) return dateTimeLocalToIso(`${dueDate}T18:00`);
    if (dueHours == null) return null;
    return new Date(base + dueHours * 36e5).toISOString();
  }
  function currentLensIso() {
    return lensDate ? dateTimeLocalToIso(`${lensDate}T12:00`) : null;
  }

  const previewRisk = lensRisk({ dueAt: currentDueIso(openedAt), lensExpectedAt: currentLensIso(), now: new Date(openedAt) });

  function pickSeller(id: string) {
    setSellerId(id);
    const chosen = activeSellers.find((item) => item.id === id);
    if (chosen && store && !externalStore && !storeSellerIds.has(id)) setStoreId("");
    inputRef.current?.focus();
  }
  function pickStore(id: string) {
    setStoreId(id);
    const links = new Set(sellerLinks.filter((link) => link.store_id === id).map((link) => link.seller_id));
    if (id && (links.size === 0 || (sellerId && !links.has(sellerId)))) setSellerId("");
    inputRef.current?.focus();
  }

  function runCommand(line: string) {
    const command = parseTargetCommand(line);
    if (!command) return false;
    if (command.kind === "seller") {
      if (command.code === 0) {
        pickSeller("");
        toast("Lançando sem vendedor.");
        return true;
      }
      const found = activeSellers.find((item) => item.quick_code === command.code);
      if (!found) {
        toast.error(`Nenhum vendedor com código ${command.code}.`);
        beep(false);
        return true;
      }
      pickSeller(found.id);
      toast.success(`Agora lançando para ${found.name} (${command.code}).`);
    } else {
      if (command.code === 0) {
        pickStore("");
        toast("Lançando sem loja.");
        return true;
      }
      const found = activeStores.find((item) => item.quick_code === command.code);
      if (!found) {
        toast.error(`Nenhuma loja com código ${command.code}.`);
        beep(false);
        return true;
      }
      pickStore(found.id);
      toast.success(`Agora lançando para ${found.trade_name} (L${command.code}).`);
    }
    beep(true);
    return true;
  }

  function launch(list: Draft[]) {
    const targets = list.filter((item) => !item.result?.ok);
    if (targets.length === 0 || !labId) return;
    startTransition(async () => {
      const all: { key: string; result?: QuickCreateResult }[] = [];
      for (let start = 0; start < targets.length; start += 100) {
        const chunk = targets.slice(start, start + 100);
        const response = await quickCreateOrders({
          entries: chunk.map((item) => ({
            orderRef: item.orderRef,
            clientName: item.clientName,
            sellerId: item.sellerId || null,
            storeId: item.storeId || null,
            dueAt: item.dueAt,
            lensExpectedAt: item.lensExpectedAt,
            lensSupplierRef: item.lensSupplierRef || null,
          })),
          laboratoryId: labId,
          dueHours: null,
          status,
          priority: urgent ? "critica" : "normal",
        });
        if (response.results.length === 0) {
          toast.error(response.message ?? "Não foi possível lançar.");
          beep(false);
          return;
        }
        chunk.forEach((item, index) => all.push({ key: item.key, result: response.results.find((result) => result.index === index) }));
      }
      const byKey = new Map(all.map((item) => [item.key, item.result]));
      setDrafts((current) => current.map((item) => (byKey.has(item.key) ? { ...item, result: byKey.get(item.key) } : item)));
      const ok = all.filter((item) => item.result?.ok).length;
      if (ok === all.length) toast.success(ok === 1 ? `${all[0].result?.number} aberta.` : `${ok} OS lançadas.`);
      else toast.warning(`${ok} de ${all.length} OS lançadas. Veja as linhas em vermelho.`);
      beep(ok === all.length);
      inputRef.current?.focus();
    });
  }

  function addFromText(value: string) {
    if (!value.includes("\n") && runCommand(value)) {
      setText("");
      return;
    }
    const entries = value.includes("\n") || value.includes(";") ? parseQuickBatch(value) : ([parseQuickEntry(value)].filter(Boolean) as QuickEntry[]);
    const dueAt = currentDueIso(Date.now());
    const lensExpectedAt = currentLensIso();
    const fresh: Draft[] = entries
      .filter((entry) => entry.orderRef || entry.clientName)
      .map((entry) => ({
        ...entry,
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sellerId,
        storeId,
        dueAt,
        lensExpectedAt,
        lensSupplierRef: lensRef.trim(),
      }));
    if (fresh.length === 0) return;
    const duplicated = fresh.find((item) => item.orderRef && drafts.some((draft) => draft.orderRef === item.orderRef));
    if (duplicated) toast.warning(`A OS ${duplicated.orderRef} já está na fila.`);
    setText("");
    setDrafts((current) => [...fresh, ...current]);
    if (instant) launch(fresh);
    else beep(true);
  }

  // Agrupa a fila pelo destino (vendedor + loja), na ordem em que foram lançados.
  const groups = useMemo(() => {
    const map = new Map<string, Draft[]>();
    for (const draft of drafts) {
      const key = `${draft.sellerId}|${draft.storeId}`;
      map.set(key, [...(map.get(key) ?? []), draft]);
    }
    return [...map.entries()].map(([key, items]) => {
      const [sid, stid] = key.split("|");
      const sellerName = activeSellers.find((item) => item.id === sid)?.name;
      const storeName = activeStores.find((item) => item.id === stid)?.trade_name;
      return { key, items, title: [sellerName, storeName].filter(Boolean).join(" · ") || "Sem vendedor e sem loja" };
    });
  }, [drafts, activeSellers, activeStores]);

  const pendingDrafts = drafts.filter((item) => !item.result?.ok);
  const createdIds = drafts.filter((item) => item.result?.ok && item.result.id).map((item) => item.result!.id!);

  if (activeLabs.length === 0) {
    return <Panel className="px-5 py-8 text-center text-sm text-[#6e7c7a]">Cadastre um laboratório em Configurações antes de lançar OS.</Panel>;
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        {/* 1. Para quem é o lote */}
        <Panel className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-[#44524f]">1 · Para quem são estas OS?</p>
            <p className="text-xs text-[#6e7c7a]">
              Atalho no campo: <kbd className="rounded border border-[#cdd5d8] bg-[#f7f9f9] px-1 font-mono">v2</kbd> vendedor 2 ·{" "}
              <kbd className="rounded border border-[#cdd5d8] bg-[#f7f9f9] px-1 font-mono">l1</kbd> loja 1 ·{" "}
              <kbd className="rounded border border-[#cdd5d8] bg-[#f7f9f9] px-1 font-mono">v0</kbd> sem vendedor
            </p>
          </div>
          <div className="mt-3 grid gap-3">
            <div className="flex items-start gap-2">
              <span className="mt-1.5 flex w-20 shrink-0 items-center gap-1 text-xs font-semibold text-[#6e7c7a]">
                <StoreIcon size={14} /> Loja
              </span>
              <div className="flex flex-wrap gap-1.5">
                <TargetChip on={!storeId} onClick={() => pickStore("")} code="0">
                  Nenhuma
                </TargetChip>
                {activeStores.map((item) => (
                  <TargetChip key={item.id} on={storeId === item.id} onClick={() => pickStore(item.id)} code={`L${codeLabel(item.quick_code)}`}>
                    {item.trade_name}
                  </TargetChip>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1.5 flex w-20 shrink-0 items-center gap-1 text-xs font-semibold text-[#6e7c7a]">
                <User size={14} /> Vendedor
              </span>
              {externalStore ? (
                <p className="rounded-lg bg-[#f2f7f6] px-3 py-1.5 text-[13px] text-[#0a4f48]">
                  <strong>{store?.trade_name}</strong> é empresa externa (sem vendedores ligados): as OS ficam só com a loja.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <TargetChip on={!sellerId} onClick={() => pickSeller("")} code="0">
                    Nenhum
                  </TargetChip>
                  {visibleSellers.map((item) => (
                    <TargetChip key={item.id} on={sellerId === item.id} onClick={() => pickSeller(item.id)} code={codeLabel(item.quick_code)}>
                      {item.name}
                    </TargetChip>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Panel>

        {/* 2. Datas */}
        <Panel className="p-4">
          <p className="text-[13px] font-semibold text-[#44524f]">2 · Prazos (valem para as próximas OS)</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div className="grid gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#6e7c7a]">
                <CalendarClock size={14} /> Prometido ao cliente
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {DUE_OPTIONS.map((option) => (
                  <Chip
                    key={option.label}
                    on={!dueDate && dueHours === option.hours}
                    onClick={() => {
                      setDueDate("");
                      setDueHours(option.hours);
                    }}
                  >
                    {option.label}
                  </Chip>
                ))}
                <Chip on={!dueDate && dueHours == null} onClick={() => { setDueDate(""); setDueHours(null); }}>
                  Sem prazo
                </Chip>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  aria-label="Data prometida ao cliente"
                  className={cn("h-8 rounded-lg border px-2 text-[13px] outline-none", dueDate ? "border-[#0e6b62] bg-[#e4f1ef] font-semibold" : "border-[#cdd5d8]")}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#6e7c7a]">
                <PackageSearch size={14} /> Previsão da lente (laboratório externo)
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="date"
                  value={lensDate}
                  onChange={(event) => setLensDate(event.target.value)}
                  aria-label="Previsão de chegada da lente"
                  className={cn("h-8 rounded-lg border px-2 text-[13px] outline-none", lensDate ? "border-[#0e6b62] bg-[#e4f1ef] font-semibold" : "border-[#cdd5d8]")}
                />
                <input
                  value={lensRef}
                  onChange={(event) => setLensRef(event.target.value.slice(0, 60))}
                  placeholder="Nº do pedido no laboratório"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-[#cdd5d8] px-2 text-[13px] outline-none focus:border-[#0e6b62]"
                />
                {lensDate || lensRef ? (
                  <button type="button" className="text-xs font-medium text-[#6e7c7a] hover:text-[#13201f]" onClick={() => { setLensDate(""); setLensRef(""); }}>
                    limpar
                  </button>
                ) : null}
              </div>
              {lensDate ? (
                <span className="w-fit rounded-md px-2 py-0.5 text-xs font-semibold" style={{ color: LENS_RISK[previewRisk.risk].fg, background: LENS_RISK[previewRisk.risk].bg }}>
                  {previewRisk.risk === "vai_atrasar"
                    ? "A lente chega depois do limite para montar: renegocie o prazo com o cliente"
                    : previewRisk.risk === "apertado"
                      ? "Folga curta para montar depois que a lente chegar"
                      : LENS_RISK[previewRisk.risk].label}
                </span>
              ) : null}
            </div>
          </div>
        </Panel>

        {/* 3. Campo de lançamento */}
        <Panel className="p-4">
          <label className="text-[13px] font-semibold text-[#44524f]" htmlFor="quick-input">
            3 · Digite ou bipe: <span className="font-normal text-[#6e7c7a]">“4521 Maria Souza”, só “4521” ou só “Maria Souza”</span>
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
                    if (text.trim()) addFromText(text);
                  }
                  if (event.key === "Escape") setText("");
                }}
                placeholder="Número da OS e/ou nome do cliente"
                className="min-h-7 flex-1 resize-none border-0 bg-transparent text-lg font-medium text-[#13201f] shadow-none outline-none placeholder:font-normal placeholder:text-[#8a9694] focus:shadow-none"
              />
            </div>
            <Button type="button" className="h-auto px-5" disabled={!text.trim()} onClick={() => addFromText(text)}>
              {instant ? "Lançar" : "Adicionar"}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-xs text-[#6e7c7a]">
            <span className="flex items-center gap-1.5">
              <Keyboard size={14} /> Indo para:{" "}
              <strong className="text-[#0a4f48]">{[seller?.name, store?.trade_name].filter(Boolean).join(" · ") || "sem vendedor e sem loja"}</strong>
            </span>
            <label className="flex cursor-pointer items-center gap-1.5 font-medium text-[#44524f]">
              <input type="checkbox" checked={instant} onChange={(event) => setInstant(event.target.checked)} className="accent-[#0e6b62]" />
              Lançar direto no Enter (modo leitor)
            </label>
          </div>
        </Panel>

        {/* Fila */}
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#e2e7e9] px-5 py-3.5">
            <h2 className="text-[15px] font-semibold">
              Lançadas nesta sessão <span className="ml-1 rounded-md bg-[#eef1f3] px-1.5 text-xs text-[#6e7c7a]">{drafts.length}</span>
            </h2>
            <div className="flex items-center gap-2">
              {drafts.length > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setDrafts([]); inputRef.current?.focus(); }}>
                  Limpar
                </Button>
              ) : null}
              {pendingDrafts.length > 0 ? (
                <Button type="button" disabled={pending} onClick={() => launch(drafts)}>
                  <Zap size={16} />
                  {pending ? "Lançando..." : `Lançar ${pendingDrafts.length} OS`}
                </Button>
              ) : null}
            </div>
          </div>
          {drafts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[#8a9694]">
              <p>Escolha o vendedor (ou a loja), bipe as OS uma a uma e troque o vendedor quando mudar o lote.</p>
              <p className="mt-1">Ex.: 10 OS da vendedora 1, depois digite <span className="font-mono">v2</span> e bipe as 10 da vendedora 2.</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.key}>
                <div className="flex items-center justify-between gap-2 bg-[#f7f9f9] px-5 py-1.5 text-xs font-semibold text-[#44524f]">
                  <span>{group.title}</span>
                  <span className="text-[#6e7c7a]">
                    {group.items.length} {group.items.length === 1 ? "OS" : "OS"}
                  </span>
                </div>
                <ul>
                  {group.items.map((item) => {
                    const risk = lensRisk({ dueAt: item.dueAt, lensExpectedAt: item.lensExpectedAt, now: new Date(openedAt) });
                    return (
                      <li key={item.key} className="grid grid-cols-[100px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#eef1f3] px-5 py-2 last:border-b-0 sm:grid-cols-[100px_minmax(0,1fr)_150px_auto]">
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
                        <span className="hidden flex-col text-[11px] leading-tight text-[#6e7c7a] sm:flex">
                          <span>Cliente: {fmt(item.dueAt)}</span>
                          <span style={{ color: item.lensExpectedAt ? LENS_RISK[risk.risk].fg === "#ffffff" ? "#b42318" : LENS_RISK[risk.risk].fg : undefined }}>
                            Lente: {item.lensExpectedAt ? fmt(item.lensExpectedAt) : "sem previsão"}
                          </span>
                        </span>
                        <div className="flex items-center justify-end gap-2">
                          {item.result ? (
                            item.result.ok ? (
                              <Link href={`/laboratorio/${item.result.id}`} className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#e3f4ea] px-2 py-1 font-mono text-xs font-semibold text-[#1c6b43]">
                                <Check size={13} /> {item.result.number}
                              </Link>
                            ) : (
                              <span className="max-w-[200px] truncate rounded-md bg-[#fdecea] px-2 py-1 text-xs font-semibold text-[#a3261b]" title={item.result.message}>
                                {item.result.message}
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-[#8a9694]">{pending ? "lançando…" : "na fila"}</span>
                          )}
                          {!item.result?.ok ? (
                            <button type="button" aria-label="Remover" className="rounded-md p-1.5 text-[#8a9694] hover:bg-[#f2f4f5] hover:text-[#b42318]" onClick={() => setDrafts((current) => current.filter((d) => d.key !== item.key))}>
                              <Trash2 size={15} />
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
          {createdIds.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e7e9] bg-[#f7f9f9] px-5 py-3 text-[13px]">
              <span className="font-medium text-[#44524f]">{createdIds.length} OS abertas nesta sessão</span>
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/laboratorio/etiquetas?ids=${createdIds.join(",")}`}>
                  <Printer size={14} /> Imprimir etiquetas ({createdIds.length})
                </Link>
              </Button>
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel className="flex flex-col gap-4 p-5 xl:sticky xl:top-20">
        <h2 className="text-[15px] font-semibold">Padrões do lançamento</h2>
        <label className="grid gap-1.5 text-[13px] font-medium text-[#44524f]">
          Laboratório
          <select value={labId} onChange={(event) => setLabId(event.target.value)} className="h-9 rounded-lg border border-[#cdd5d8] bg-white px-2.5 text-sm text-[#13201f] outline-none focus:border-[#0e6b62]">
            {activeLabs.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium text-[#44524f]">Situação ao entrar</span>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={status === "aguardando_lentes"} onClick={() => setStatus("aguardando_lentes")}>
              Aguardando lentes
            </Chip>
            <Chip on={status === "aguardando_montagem"} onClick={() => setStatus("aguardando_montagem")}>
              Lentes já na bancada
            </Chip>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e2e7e9] px-3 py-2.5 text-[13px] font-medium">
          <input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} className="accent-[#b42318]" />
          Marcar como urgente
        </label>
        <div className="grid gap-2 rounded-lg bg-[#f7f9f9] px-3 py-3 text-xs leading-relaxed text-[#44524f]">
          <p className="font-semibold">Como lançar um lote misturado</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Separe as OS por vendedor (ou por loja externa).</li>
            <li>Clique no vendedor ou digite <span className="font-mono">v1</span>.</li>
            <li>Bipe ou digite cada OS e aperte Enter.</li>
            <li>
              Mudou o lote? Digite <span className="font-mono">v2</span> (ou <span className="font-mono">l2</span> para loja) e continue.
            </li>
          </ol>
          <p className="text-[#6e7c7a]">Os códigos dos vendedores e lojas aparecem nos botões e podem ser alterados no cadastro.</p>
        </div>
      </Panel>
    </div>
  );
}

function TargetChip({ on, onClick, code, children }: { on: boolean; onClick: () => void; code: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg border pl-1 pr-2.5 text-[13px] font-semibold transition-colors",
        on ? "border-[#0e6b62] bg-[#0e6b62] text-white shadow-sm" : "border-[#cdd5d8] bg-white text-[#44524f] hover:bg-[#f7f9f9]",
      )}
    >
      <span className={cn("grid h-6 min-w-6 place-items-center rounded-md px-1 font-mono text-[11px]", on ? "bg-white/20" : "bg-[#eef1f3] text-[#6e7c7a]")}>{code}</span>
      {children}
    </button>
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
