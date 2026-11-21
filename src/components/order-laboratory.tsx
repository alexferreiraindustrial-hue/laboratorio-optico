"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { laboratoryOptions, updateOrderLaboratory } from "@/server/flow-actions";
import { Button, Feedback } from "./ui";
export function OrderLaboratory({orderId}:{orderId:string}) {
 const router=useRouter(); const [options,setOptions]=useState<{id:string;name:string}[]>([]); const [error,setError]=useState<string|null>(null); const [message,setMessage]=useState<string|null>(null); const [pending,start]=useTransition();
 return <details className="mt-2 text-sm" onToggle={event=>{if(event.currentTarget.open && !options.length) start(async()=>{try{setOptions(await laboratoryOptions());}catch{setError("Não foi possível carregar os laboratórios.");}});}}>
 <summary className="min-h-11 cursor-pointer py-2 font-semibold text-[var(--link)]">Alterar laboratório</summary>
 <form className="grid gap-2 py-2" onSubmit={event=>{event.preventDefault();const id=String(new FormData(event.currentTarget).get("lab")??"");start(async()=>{try{const result=await updateOrderLaboratory(orderId,id);if(!result.ok){setError(result.message);return;}setError(null);setMessage(result.message??"Salvo");router.refresh();}catch{setError("Não foi possível salvar. Tente novamente.");}});}}>
 <label>Laboratório onde a lente foi pedida<select name="lab" required defaultValue="" disabled={pending} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[var(--ink)]"><option value="" disabled>Escolha o laboratório</option>{options.map(lab=><option key={lab.id} value={lab.id}>{lab.name}</option>)}</select></label>
 <p className="text-xs text-[var(--muted)]">Escolha A definir se ainda não souber o fornecedor. Apenas esta OS será alterada ao salvar.</p><Button disabled={pending||!options.length} type="submit" variant="secondary">{pending?"Aguarde…":"Salvar laboratório"}</Button><Feedback error={error} message={message}/></form></details>;
}
