"use client";

import { ArrowRight, Check, PackageCheck, PackageOpen, ScanLine, X, Zap } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { STATUS_LABEL, type AppRole, type OrderStatus } from "@/lib/domain/constants";
import { can } from "@/lib/domain/permissions";
import type { Laboratory, Seller, SellerStoreLink, Store } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  findOrdersForQuick,
  quickMoveOrders,
  type FoundOrder,
} from "@/server/quick-actions";
import { EntryLaunch } from "./entry-launch";
import { StatusBadge } from "./status-badge";
import { Button, Panel } from "./ui";

type Mode = "entrada" | "lentes" | "saida";

const MODES: { key: Mode; label: string; hint: string; icon: typeof Zap }[] = [
  { key: "entrada", label: "Entrada de OS", hint: "Abre OS só com número, só com nome ou com os dois.", icon: Zap },
  { key: "lentes", label: "Chegada de lentes", hint: "Libera para a montagem as OS cujas lentes chegaram.", icon: PackageOpen },
  { key: "saida", label: "Saída / entrega", hint: "Registra a retirada das OS prontas.", icon: PackageCheck },
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
    /* sem áudio, sem problema */
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
        <EntryLaunch laboratories={laboratories} sellers={sellers} stores={stores} sellerLinks={sellerLinks} />
      ) : (
        <MoveMode key={mode} mode={mode} />
      )}
    </div>
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
