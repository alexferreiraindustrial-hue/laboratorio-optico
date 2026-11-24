"use client";
import {useState,useTransition} from "react";
import {changeOrderStatus} from "@/server/actions";
import {useRouter} from "next/navigation";
import type {OrderOperations} from "@/lib/domain/operations";
import {saveMedicalReview,approveMedicalReview} from "@/server/followup-actions";
import {Button,Feedback} from "./ui";
export function MedicalReview({id,order,status,editable}:{id:string;order:OrderOperations;status:string;editable:boolean}){
 const router=useRouter();const[pending,start]=useTransition();const[error,setError]=useState<string|null>(null);const[message,setMessage]=useState<string|null>(null);
 const closed=["pronto","entregue","cancelado"].includes(status);
 function run(action:()=>Promise<{ok:boolean;message?:string}>){if(pending)return;start(async()=>{setError(null);setMessage(null);try{const result=await action();if(!result.ok)setError(result.message||"Não foi possível confirmar.");else{setMessage(result.message||"Salvo.");router.refresh();}}catch{setError("Não foi possível confirmar. Atualize a tela antes de tentar novamente.");}});}
 return <section className="mt-3 grid gap-3 rounded-lg border border-[var(--line)] p-3">
  <div><h2 className="text-sm font-semibold">Conferência Médico</h2><p className="mt-1 text-xs text-[var(--muted)]">{order.medical_review_required?order.medical_review_approved_at?"Retorno médico registrado · liberação concluída":"Precisa do retorno médico antes de avisar como pronto ou entregar.":"Sem indicação médica. Segue a conferência técnica normal da montagem."}</p></div>
  {editable&&!closed&&<label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(order.medical_review_required)} disabled={pending||!order.updated_at} onChange={event=>{const required=event.target.checked;run(()=>saveMedicalReview(id,required,order.updated_at!));}}/>Precisa passar pelo médico</label>}
  {editable&&status==="pronto"&&<Button variant="secondary" disabled={pending} onClick={()=>run(()=>changeOrderStatus(id,"em_conferencia","Encaminhamento médico decidido após o serviço pronto"))}>Enviar ao médico · decisão após a montagem</Button>}
  {order.medical_review_note&&<p className="text-sm">{order.medical_review_note}</p>}
  {editable&&status==="em_conferencia"&&order.medical_review_required&&!order.medical_review_approved_at&&<form className="grid gap-2" onSubmit={event=>{event.preventDefault();const note=String(new FormData(event.currentTarget).get("note")||"");run(()=>approveMedicalReview(id,note,order.updated_at!));}}><label className="text-xs font-medium">Quem conferiu e qual foi o retorno?<textarea required name="note" minLength={3} maxLength={1000} rows={2} disabled={pending} placeholder="Ex.: Dr. João · conferido e liberado em 23/11" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-sm"/></label><p className="text-xs text-[var(--muted)]">Registre somente após receber a confirmação do médico. Se precisar corrigir, use Em correção e registre a ocorrência.</p><Button disabled={pending||!order.updated_at} type="submit">{pending?"Registrando…":"Confirmar retorno médico e liberar"}</Button></form>}
  <Feedback error={error} message={message}/>
 </section>;
}
