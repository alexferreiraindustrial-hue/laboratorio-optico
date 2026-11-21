"use client";
import { PENDING_LABORATORY, PENDING_LABORATORY_CODE, PENDING_LABORATORY_NAME } from "@/lib/domain/laboratories";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { dateTimeLocalToIso } from "@/lib/domain/calendar";
import { validateGuidedEntry } from "@/lib/domain/guided-entry";
import type { Laboratory, Seller, SellerStoreLink, Store } from "@/lib/types";
import { createGuidedOrder } from "@/server/quick-actions";

const field = "mt-1 min-h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-base outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20 disabled:opacity-60";

export function GuidedEntry({ laboratories, sellers, stores, sellerLinks }: { laboratories: Laboratory[]; sellers: Seller[]; stores: Store[]; sellerLinks: SellerStoreLink[] }) {
  const labs = laboratories.filter((item) => item.active && item.code !== PENDING_LABORATORY_CODE);
  const [laboratoryId, setLaboratoryId] = useState(PENDING_LABORATORY);
  const [sellerId, setSellerId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [clientName, setClientName] = useState("");
  const [due, setDue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; number: string } | null>(null);
  const [pending, startSave] = useTransition();
  const inFlight = useRef(false);
  const numberRef = useRef<HTMLInputElement>(null);
  const linked = sellerLinks.filter((item) => item.seller_id === sellerId).map((item) => item.store_id);
  const availableStores = stores.filter((item) => item.active && (!linked.length || linked.includes(item.id)));

  function chooseSeller(value: string) {
    setSellerId(value);
    const ids = sellerLinks.filter((item) => item.seller_id === value).map((item) => item.store_id);
    const choices = stores.filter((item) => item.active && ids.includes(item.id));
    setStoreId(choices.length === 1 ? choices[0].id : "");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || saved) return;
    let dueAt = "";
    try { dueAt = dateTimeLocalToIso(due); } catch { setMessage("Confira a data e o horário do prazo."); return; }
    const input = { laboratoryId, sellerId, storeId, orderRef, clientName, dueAt };
    const error = validateGuidedEntry(input);
    if (error) { setMessage(error); return; }
    inFlight.current = true;
    setMessage(null);
    startSave(async () => {
      try {
        const result = await createGuidedOrder(input);
        const created = result.results.find((item) => item.ok && item.id);
        if (created?.id) setSaved({ id: created.id, number: created.number || orderRef });
        else setMessage(result.results[0]?.message || result.message || "Não foi possível salvar. Confira os campos.");
      } catch { setMessage("Não foi possível confirmar o cadastro. Consulte a fila antes de tentar novamente para evitar repetir a OS."); }
      finally { inFlight.current = false; }
    });
  }

  if (saved) return <section role="status" className="mx-auto grid w-full max-w-3xl gap-4 rounded-2xl border border-[var(--edge-b5ddd0)] bg-[var(--surface)] p-6">
    <CheckCircle2 size={40} className="text-[var(--link)]" /><h2 className="text-2xl font-bold">OS {saved.number} cadastrada</h2>
    <p className="text-base text-[var(--muted)]">Agora coloque o material na gaveta de <strong>{sellers.find((item) => item.id === sellerId)?.name}</strong>. O serviço está aguardando lentes.</p>
    <p className="text-sm text-[var(--muted)]">Você pode completar cliente, pedido e previsão de chegada depois.</p>
    <div className="flex flex-wrap gap-3"><button type="button" onClick={() => { setSaved(null); setOrderRef(""); setClientName(""); setDue(""); setMessage(null); requestAnimationFrame(() => numberRef.current?.focus()); }} className="min-h-12 rounded-lg bg-[var(--accent)] px-5 font-semibold text-white">Cadastrar outra OS</button><Link href={`/laboratorio?os=${saved.id}`} className="flex min-h-12 items-center rounded-lg border border-[var(--line)] px-4 font-semibold text-[var(--link)]">Ver ou completar esta OS</Link></div>
  </section>;

  return <form onSubmit={submit} className="mx-auto grid w-full max-w-3xl gap-4">
    <header><h2 className="text-xl font-bold">Cadastrar uma OS</h2><p className="mt-1 text-sm text-[var(--muted)]">Preencha os campos abaixo e clique em “Salvar OS”. Nada é salvo enquanto você digita.</p></header>
    <fieldset disabled={pending} className="grid gap-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 disabled:opacity-70">
      <legend className="px-2 text-base font-bold">1. Quem vendeu?</legend>
      <label className="font-semibold">Vendedor<select required value={sellerId} onChange={(event) => chooseSeller(event.target.value)} className={field}><option value="">Escolha o vendedor</option>{sellers.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {<label className="font-semibold">Laboratório das lentes <span className="text-sm font-normal text-[var(--muted)]">(pode definir depois)</span><select required value={laboratoryId} onChange={(event) => setLaboratoryId(event.target.value)} className={field}><option value={PENDING_LABORATORY}>{PENDING_LABORATORY_NAME}</option>{labs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {availableStores.length > 0 ? <label className="font-semibold">Loja <span className="text-sm font-normal text-[var(--muted)]">(se necessário)</span><select value={storeId} onChange={(event) => setStoreId(event.target.value)} className={field}><option value="">Sem loja informada</option>{availableStores.map((item) => <option key={item.id} value={item.id}>{item.trade_name}</option>)}</select></label> : null}
    </fieldset>
    <fieldset disabled={pending} className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <legend className="px-2 text-base font-bold">2. Qual é o serviço?</legend>
      <label className="font-semibold">Número da OS<input ref={numberRef} required maxLength={80} value={orderRef} onChange={(event) => setOrderRef(event.target.value)} placeholder="Ex.: 4521" autoComplete="off" className={field} /><span className="mt-1 block text-sm font-normal text-[var(--muted)]">Copie o número que está na ordem de serviço.</span></label>
      <label className="font-semibold">Cliente <span className="text-sm font-normal text-[var(--muted)]">(pode preencher depois)</span><input value={clientName} maxLength={200} onChange={(event) => setClientName(event.target.value)} placeholder="Nome do cliente" className={field} /></label>
    </fieldset>
    <fieldset disabled={pending} className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <legend className="px-2 text-base font-bold">3. Quando foi prometido?</legend>
      <label className="font-semibold">Data e horário da entrega<input required type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} className={field} /></label><p className="text-sm text-[var(--muted)]">Use o prazo combinado com o cliente. Horário de Brasília.</p>
    </fieldset>
    {message ? <div role="alert" className="rounded-xl border border-[var(--edge-f1c4be)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">{message}<Link href="/laboratorio" className="mt-2 block min-h-11 py-2 font-semibold underline">Consultar OS já cadastradas</Link></div> : null}
    <button type="submit" disabled={pending || !sellers.some((item) => item.active)} className="min-h-14 rounded-xl bg-[var(--accent)] px-5 text-lg font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50">{pending ? "Salvando OS… aguarde" : "Salvar OS"}</button>
    {!sellers.some((item) => item.active) ? <p role="alert" className="text-sm text-[var(--danger)]">Cadastre pelo menos um vendedor ativo no modo Completo antes de começar.</p> : null}
    <p className="text-center text-xs text-[var(--muted)]">Para cadastrar várias OS de uma vez ou usar atalhos, escolha “Ver menu completo”.</p>
  </form>;
}
