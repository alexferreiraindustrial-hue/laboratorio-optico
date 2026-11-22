"use client";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Glasses, Timer, Wrench } from "lucide-react";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { INTERNAL_ASSEMBLY_CODE, INTERNAL_MAINTENANCE_CODE, PENDING_LABORATORY, PENDING_LABORATORY_CODE, PENDING_LABORATORY_NAME } from "@/lib/domain/laboratories";
import {FRAME_LABEL,EXPRESS_MINUTES,type FrameState} from "@/lib/domain/operations";
import { dateTimeLocalToIso } from "@/lib/domain/calendar";
import { validateGuidedEntry } from "@/lib/domain/guided-entry";
import { toDateTimeLocalValue } from "@/lib/format";
import type { Laboratory, Seller, SellerStoreLink, Store } from "@/lib/types";
import { createGuidedOrder } from "@/server/quick-actions";

const field = "mt-1.5 min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-base font-normal text-[var(--ink)] sm:text-sm outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20 disabled:opacity-60";
const label = "text-sm font-semibold text-[var(--ink)]";
function quickDeadline(minutes:number){return toDateTimeLocalValue(new Date(Date.now()+minutes*60000).toISOString());}
const shortcuts = ["Ajuste de armação", "Troca de plaquetas", "Troca de parafuso", "Limpeza"];

export function GuidedEntry({ laboratories, sellers, stores, sellerLinks }: { laboratories: Laboratory[]; sellers: Seller[]; stores: Store[]; sellerLinks: SellerStoreLink[] }) {
 const [serviceKind,setServiceKind]=useState<"lentes"|"manutencao"|"expressa">("lentes");
 const express=serviceKind==="expressa";
 const [expressMinutes,setExpressMinutes]=useState(40);
 const [frameState,setFrameState]=useState<FrameState>("unknown");
 const maintenance=serviceKind==="manutencao";
 const labs=laboratories.filter(item=>item.active&&item.code!==PENDING_LABORATORY_CODE&&item.code!==INTERNAL_MAINTENANCE_CODE&&item.code!==INTERNAL_ASSEMBLY_CODE);
 const [laboratoryId,setLaboratoryId]=useState(PENDING_LABORATORY);
 const [sellerId,setSellerId]=useState("");const[storeId,setStoreId]=useState("");
 const [maintenanceRef,setMaintenanceRef]=useState("");
 const [orderRef,setOrderRef]=useState("");const[clientName,setClientName]=useState("");const[description,setDescription]=useState("");
 const [due,setDue]=useState("");const[maintenanceDue,setMaintenanceDue]=useState("");
 const [message,setMessage]=useState<string|null>(null);
 const [saved,setSaved]=useState<{id:string;number:string;maintenance:boolean;express:boolean}|null>(null);
 const [pending,startSave]=useTransition();const inFlight=useRef(false);const primaryRef=useRef<HTMLInputElement>(null);
 const linked=sellerLinks.filter(item=>item.seller_id===sellerId).map(item=>item.store_id);
 const availableStores=stores.filter(item=>item.active&&(!linked.length||linked.includes(item.id)));
 const currentDue=(maintenance||express)?maintenanceDue:due;
 function chooseSeller(value:string){setSellerId(value);const ids=sellerLinks.filter(item=>item.seller_id===value).map(item=>item.store_id);const choices=stores.filter(item=>item.active&&ids.includes(item.id));setStoreId(choices.length===1?choices[0].id:"");}
 function setQuickDue(minutes:number){setMaintenanceDue(quickDeadline(minutes));}
 function chooseKind(value:typeof serviceKind){setServiceKind(value);setMessage(null);if(value==="expressa"){setFrameState("present");setQuickDue(expressMinutes);}if(value==="manutencao"&&!maintenanceDue)setQuickDue(60);}
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(inFlight.current||saved)return;
  let dueAt="";try{dueAt=dateTimeLocalToIso(currentDue);}catch{setMessage("Informe o prazo combinado para este serviço.");return;}
  const input={serviceKind,frameState,expressMinutes:express?expressMinutes:undefined,serviceDescription:description,laboratoryId,sellerId,storeId,orderRef:(maintenance||express)?maintenanceRef:orderRef,clientName,dueAt};
  const error=validateGuidedEntry(input);if(error){setMessage(error);return;}
  inFlight.current=true;setMessage(null);
  startSave(async()=>{try{const result=await createGuidedOrder(input);const created=result.results.find(item=>item.ok&&item.id);if(created?.id)setSaved({id:created.id,number:created.number||orderRef,maintenance,express});else setMessage(result.results[0]?.message||result.message||"Não foi possível salvar. Confira os campos.");}catch{setMessage("Não foi possível confirmar o cadastro. Consulte a fila antes de tentar novamente para evitar duplicar o serviço.");}finally{inFlight.current=false;}});
 }
 if(saved)return <section role="status" className="mx-auto grid w-full max-w-4xl gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
  <CheckCircle2 size={36} className="text-[var(--ok)]"/><div><h2 className="text-xl font-bold">{saved.express?"Montagem expressa registrada":saved.maintenance?"Manutenção registrada":"OS cadastrada"}</h2><p className="mt-1 font-mono text-sm text-[var(--link)]">{saved.number}</p></div>
  <p className="text-sm text-[var(--muted)]">{(saved.maintenance||saved.express)?"O serviço já está na bancada. Use este número interno para acompanhar, anexar fotos e concluir o atendimento.":"Coloque o material na gaveta da vendedora. O serviço já está na lista de lentes a chegar."}</p>
  <p className="text-sm"><strong>Vendedora:</strong> {sellers.find(item=>item.id===sellerId)?.name}</p>
  <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>{setSaved(null);setOrderRef("");setMaintenanceRef("");setClientName("");setDescription("");setDue("");setMaintenanceDue("");if(maintenance||express)setQuickDue(express?expressMinutes:60);setFrameState(express?"present":"unknown");setMessage(null);requestAnimationFrame(()=>primaryRef.current?.focus());}} className="min-h-11 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">Lançar outro serviço</button><Link href={(saved.maintenance||saved.express)?`/montagem?os=${saved.id}`:`/lentes?os=${saved.id}`} className="flex min-h-11 items-center rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[var(--link)]">{(saved.maintenance||saved.express)?"Ver na bancada":"Ver ou completar OS"}</Link></div>
 </section>;
 return <form onSubmit={submit} className="mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
  <fieldset disabled={pending} className="grid gap-5 p-4 disabled:opacity-70 sm:p-5">
   <legend className="sr-only">Lançar serviço</legend>
   <div className="grid gap-2 sm:grid-cols-3" aria-label="Tipo de serviço">{([{key:"lentes",name:"Pedido de lentes",hint:"Com a OS da venda",icon:Glasses},{key:"expressa",name:"Montagem expressa",hint:"20, 40 ou 60 minutos",icon:Timer},{key:"manutencao",name:"Manutenção rápida",hint:"Sem precisar de OS",icon:Wrench}] as const).map(item=><button key={item.key} type="button" aria-pressed={serviceKind===item.key} onClick={()=>chooseKind(item.key)} className={`flex min-h-16 items-center gap-2 rounded-lg border p-3 text-left ${serviceKind===item.key?"border-[var(--focus)] bg-[var(--accent-soft)] text-[var(--link)]":"border-[var(--line)] text-[var(--muted)] hover:bg-[var(--background)]"}`}><item.icon size={20} className="hidden shrink-0 sm:block"/><span><span className="block text-sm font-semibold">{item.name}</span><span className="mt-0.5 block text-xs">{item.hint}</span></span></button>)}</div>
   {express&&<div className="rounded-lg bg-[var(--accent-soft)] p-3"><p className="text-sm font-semibold">Tempo de montagem</p><div className="mt-2 flex gap-2">{EXPRESS_MINUTES.map(minutes=><button key={minutes} type="button" aria-pressed={expressMinutes===minutes} onClick={()=>{setExpressMinutes(minutes);setQuickDue(minutes);}} className={`min-h-11 flex-1 rounded-lg border px-3 text-sm font-semibold ${expressMinutes===minutes?"border-[var(--accent)] bg-[var(--accent)] text-white":"border-[var(--line)] bg-[var(--surface)] text-[var(--link)]"}`}>{minutes} min</button>)}</div><p className="mt-2 text-xs text-[var(--muted)]">Use quando lentes e armação já estão disponíveis. Entra na bancada; o contador começa ao iniciar a montagem.</p></div>}
   <div className="grid gap-4 sm:grid-cols-2">
    <label className={label}>Vendedora / responsável<select required value={sellerId} onChange={event=>chooseSeller(event.target.value)} className={field}><option value="">Selecione quem trouxe o serviço</option>{sellers.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className={label}>{(maintenance||express)?"Cliente ou identificação":"Número da OS"}{(maintenance||express)&&<span className="ml-1 text-xs font-normal text-[var(--muted)]">(opcional)</span>}<input ref={primaryRef} required={!maintenance&&!express} maxLength={(maintenance||express)?200:80} value={(maintenance||express)?clientName:orderRef} onChange={event=>(maintenance||express)?setClientName(event.target.value):setOrderRef(event.target.value)} placeholder={(maintenance||express)?"Ex.: Maria · armação preta":"Ex.: 4521"} autoComplete="off" className={field}/></label>
   </div>
   {maintenance?<div><p className={label}>O que precisa ser feito?</p><div className="mt-2 flex flex-wrap gap-1.5">{shortcuts.map(text=><button key={text} type="button" aria-pressed={description===text} onClick={()=>setDescription(text)} className={`min-h-11 rounded-lg border px-3 text-xs font-medium ${description===text?"border-[var(--focus)] bg-[var(--accent-soft)] text-[var(--link)]":"border-[var(--line)] text-[var(--muted)] hover:bg-[var(--background)]"}`}>{text}</button>)}</div><label className="sr-only" htmlFor="maintenance-description">Descrição da manutenção</label><textarea id="maintenance-description" required minLength={3} maxLength={500} rows={2} value={description} onChange={event=>setDescription(event.target.value)} placeholder="Escolha acima ou descreva a manutenção…" className={`${field} py-2.5`}/></div>:null}
   <div className="grid gap-4 sm:grid-cols-2">
    <label className={label}>Prazo combinado<input required type="datetime-local" value={currentDue} onChange={event=>(maintenance||express)?setMaintenanceDue(event.target.value):setDue(event.target.value)} className={field}/><span className="mt-1 block text-xs font-normal text-[var(--muted)]">Horário de Brasília.</span></label>
    {(maintenance||express)?<div className="flex flex-col justify-center gap-1.5"><span className="text-xs text-[var(--muted)]">Prazo rápido a partir de agora</span><div className="flex gap-2">{(express?[20,40,60]:[30,60,120]).map(minutes=><button key={minutes} type="button" onClick={()=>setQuickDue(minutes)} className="min-h-11 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[var(--link)] hover:bg-[var(--accent-soft)]">{minutes<60?`${minutes} min`:`${minutes/60} h`}</button>)}</div></div>:<label className={label}>Cliente <span className="text-xs font-normal text-[var(--muted)]">(pode preencher depois)</span><input value={clientName} maxLength={200} onChange={event=>setClientName(event.target.value)} placeholder="Nome do cliente" className={field}/></label>}
   </div>
   {!express&&<label className="text-xs text-[var(--muted)]">Armação · opcional<select value={frameState} onChange={event=>setFrameState(event.target.value as FrameState)} className={field}>{Object.entries(FRAME_LABEL).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>}
   <details className="group rounded-lg border border-[var(--line)]"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium text-[var(--link)]">{(maintenance||express)?"OS e loja · opcionais":"Laboratório e loja · pode completar depois"}<ChevronDown size={16} className="group-open:rotate-180"/></summary><div className="grid gap-3 border-t border-[var(--line)] p-3 sm:grid-cols-2">{(maintenance||express)&&<label className={label}>Número da OS <span className="text-xs font-normal text-[var(--muted)]">(se já tiver)</span><input value={maintenanceRef} onChange={event=>setMaintenanceRef(event.target.value)} maxLength={80} placeholder="Deixe vazio para gerar automaticamente" className={field}/></label>}{!maintenance&&!express&&<label className={label}>Laboratório das lentes<select value={laboratoryId} onChange={event=>setLaboratoryId(event.target.value)} className={field}><option value={PENDING_LABORATORY}>{PENDING_LABORATORY_NAME}</option>{labs.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<label className={label}>Loja<select value={storeId} onChange={event=>setStoreId(event.target.value)} className={field}><option value="">Sem loja informada</option>{availableStores.map(item=><option key={item.id} value={item.id}>{item.trade_name}</option>)}</select></label></div></details>
   {message&&<div role="alert" className="rounded-lg border border-[var(--line)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">{message}<Link href="/laboratorio" className="mt-1 block min-h-11 py-2 font-semibold underline">Consultar serviços cadastrados</Link></div>}
   {!sellers.some(item=>item.active)&&<p role="alert" className="text-sm text-[var(--danger)]">Cadastre uma vendedora ou responsável ativo antes de lançar o serviço.</p>}
  </fieldset>
  <footer className="flex flex-col gap-3 border-t border-[var(--line)] bg-[var(--background)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-xs text-[var(--muted)]">{(maintenance||express)?(maintenanceRef.trim()?"Usa a OS informada · segue direto para a bancada.":"Número interno automático · segue direto para a bancada."):"Segue para Lentes. Você pode completar os dados depois."}</p><button type="submit" disabled={pending||!sellers.some(item=>item.active)} className="min-h-12 rounded-lg bg-[var(--accent)] px-6 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50">{pending?"Salvando… aguarde":express?"Lançar montagem expressa":maintenance?"Registrar manutenção":"Salvar serviço"}</button></footer>
 </form>;
}
