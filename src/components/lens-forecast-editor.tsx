"use client";

import { OrderLaboratory } from "./order-laboratory";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { updateLensForecast } from "@/server/flow-actions";
import { Button, Feedback, Field, Input } from "./ui";

export function LensForecastEditor({ orderId, expectedAt, supplierRef }: { orderId: string; expectedAt?: string | null; supplierRef?: string | null }) {
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  const router = useRouter();
  const initialDate = expectedAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(expectedAt)) : "";
  return <><OrderLaboratory orderId={orderId}/><form className="mt-5 grid gap-4 border-t border-[var(--line)] pt-5" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(async () => {
      const result = await updateLensForecast(orderId, String(data.get("date") || "") || null, String(data.get("ref") || "") || null);
      setFeedback(result.ok ? { message: result.message ?? "Pedido atualizado." } : { error: result.message });
      if (result.ok) router.refresh();
    });
  }}>
    <div><h2 className="flex items-center gap-2 text-sm font-bold"><PackageSearch size={17} className="text-[var(--link)]" /> Pedido de lentes</h2><p className="mt-1 text-xs text-[var(--muted)]">A previsão de chegada é comparada ao prazo prometido, reservando tempo para montagem.</p></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Previsão de chegada"><Input type="date" name="date" defaultValue={initialDate} /></Field><Field label="Número do pedido no fornecedor"><Input name="ref" maxLength={60} defaultValue={supplierRef ?? ""} placeholder="Ex.: 987654" /></Field></div>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" variant="secondary" disabled={pending}>{pending ? "Salvando pedido…" : "Salvar pedido de lentes"}</Button><Feedback {...feedback} /></div>
  </form></>;
}
