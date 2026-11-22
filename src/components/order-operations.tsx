"use client";
import {useEffect,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {FRAME_LABEL,EXPRESS_MINUTES,expressClock,type OrderOperations,type FrameState} from "@/lib/domain/operations";
import {configureOrderOperations,receiveOrderFrame} from "@/server/operations-actions";
import {Button,Feedback} from "./ui";
export function ExpressCountdown({operations,nowIso}:{operations:OrderOperations;nowIso:string}){
 const [clock,setClock]=useState(nowIso);
 useEffect(()=>{if(!operations.express_started_at||operations.express_finished_at)return;const timer=window.setInterval(()=>setClock(new Date().toISOString()),1000);return()=>window.clearInterval(timer);},[operations.express_started_at,operations.express_finished_at]);
 const signal=expressClock(operations,new Date(clock));if(!signal)return null;
 return <p role="timer" aria-live="off" className={`rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${signal.tone==="late"?"bg-[var(--danger-soft)] text-[var(--danger)]":signal.tone==="soon"?"bg-[var(--warning-soft)] text-[var(--warning)]":"bg-[var(--accent-soft)] text-[var(--link)]"}`}>{signal.label}</p>;
}
export function OrderOperationsEditor({id,operations,status}:{id:string;operations:OrderOperations;status:string}){
 const router=useRouter();const[pending,start]=useTransition();const[error,setError]=useState<string|null>(null);const[message,setMessage]=useState<string|null>(null);
 const vta=operations.frame_state==="vta";const locked=Boolean(operations.express_started_at)||!["aguardando_lentes","aguardando_montagem"].includes(status);
 return <form className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3" onSubmit={event=>{event.preventDefault();if(pending)return;const data=new FormData(event.currentTarget);const frame=String(data.get("frame")||operations.frame_state||"unknown") as FrameState;const minutes=locked?operations.express_minutes??null:data.get("minutes")?Number(data.get("minutes")):null;start(async()=>{setError(null);setMessage(null);try{const result=vta?await receiveOrderFrame(id,minutes):await configureOrderOperations(id,frame,minutes,operations.updated_at);if(!result.ok){setError(result.message);return;}setMessage(result.message??"Salvo.");router.refresh();}catch{setError("Não foi possível salvar. Confira a conexão e atualize a tela.");}});}}>
  <div><p className="text-sm font-semibold">{vta?"VTA · receber armação":"Armação e tempo de montagem"}</p><p className="mt-1 text-xs text-[var(--muted)]">{vta?operations.lens_arrived_at?"A lente está no laboratório. Confirme abaixo somente quando receber a armação do cliente.":"A armação pode ser recebida antes da lente. A OS continuará aguardando lentes.":"Informação opcional. O contador começa no primeiro início da montagem."}</p></div>
  {!vta&&<label className="text-xs font-medium">Armação<select name="frame" defaultValue={operations.frame_state??"unknown"} disabled={pending} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-sm">{Object.entries(FRAME_LABEL).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
  <label className="text-xs font-medium">Montagem<select name="minutes" defaultValue={operations.express_minutes??""} disabled={pending||locked} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"><option value="">Normal · sem contador</option>{EXPRESS_MINUTES.map(minutes=><option key={minutes} value={minutes}>Expressa · {minutes} minutos</option>)}</select></label>
  <Button type="submit" variant={vta?"default":"secondary"} disabled={pending}>{pending?"Salvando…":vta?"Armação chegou · confirmar":"Salvar armação e modalidade"}</Button><Feedback error={error} message={message}/>
 </form>;
}
