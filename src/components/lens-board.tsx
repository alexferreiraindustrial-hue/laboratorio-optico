"use client";
import { PackageOpen, Printer, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { LENS_RISK, lensRisk, type LensRisk } from "@/lib/domain/flow";
import { lensPriority, sortLensPriority } from "@/lib/domain/lens-priority";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { dueDeltaLabel } from "@/lib/domain/urgency";
import { formatDateTime } from "@/lib/format";
import { updateLensForecast } from "@/server/flow-actions";
import { quickMoveOrders } from "@/server/quick-actions";
import type { LensQueueRow } from "@/server/flow";
import { LensArrival } from "./lens-arrival";
import { OrderLaboratory } from "./order-laboratory";
import { Button, Feedback, Field, Input } from "./ui";
const ymd = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo"});

function LensLine({row,now,index,selected,onToggle,canEdit,canRelease,disabled}:{row:LensQueueRow;now:Date;index:number;selected:boolean;onToggle:()=>void;canEdit:boolean;canRelease:boolean;disabled:boolean}) {
 const router=useRouter(); const priority=lensPriority(row,now);
 const risk=lensRisk({dueAt:row.due_at,lensExpectedAt:row.lens_expected_at,now});
 const tone=LENS_RISK[risk.risk];
 const [pending,start]=useTransition();const[error,setError]=useState<string|null>(null);const[message,setMessage]=useState<string|null>(null);
 return <li className="lens-priority-row rounded-xl border p-3" data-urgency={priority.level}>
  <div className="flex items-start gap-3">
   <label className="flex min-h-11 w-8 shrink-0 items-center justify-center"><input type="checkbox" checked={selected} disabled={disabled} onChange={onToggle} aria-label={`Selecionar OS ${visibleOrderNumber(row)}`} className="h-5 w-5"/></label>
   <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1.2fr)_minmax(130px,.85fr)_minmax(160px,1fr)_minmax(170px,1fr)]">
    <div className="col-span-2 min-w-0 md:col-span-1"><Link href={`/lentes?os=${row.id}`} scroll={false} className="inline-flex min-h-7 items-center gap-2 text-xs font-semibold text-[var(--link)]"><span className="text-[var(--muted)]">#{index+1}</span><span className="break-all font-mono">OS {visibleOrderNumber(row)}</span></Link><p className="break-words text-base font-semibold leading-snug">{row.client_name}</p><p className="mt-1 break-words text-xs text-[var(--muted)]">{row.seller_name||"Sem vendedora"}{row.store_name?` · ${row.store_name}`:""}</p></div>
    <div><p className="text-xs text-[var(--muted)]">Prazo do cliente</p><p className="mt-1 text-sm font-semibold">{row.due_at?formatDateTime(row.due_at):"Não informado"}</p>{row.due_at && <p className="lens-priority-text mt-1 text-xs font-semibold">{dueDeltaLabel(row.due_at,now,"aguardando_lentes")}</p>}<span className="lens-priority-badge mt-2 inline-block rounded-md px-2 py-1 text-xs font-bold">{priority.label}</span></div>
    <div><p className="text-xs text-[var(--muted)]">Laboratório das lentes</p><p className="mt-1 break-words text-sm font-semibold">{row.laboratory_name||"Não informado"}</p>{canEdit && <OrderLaboratory orderId={row.id}/>}<p className="mt-1 text-xs text-[var(--muted)]">Chegada: {row.lens_expected_at?formatDateTime(row.lens_expected_at):"sem previsão"}</p></div>
    <div className="col-span-2 md:col-span-1"><span className="inline-block rounded-md px-2 py-1 text-xs font-semibold" style={{color:tone.fg,background:tone.bg}}>{tone.label}</span>{canRelease && <><LensArrival orderId={row.id} showLaboratory={false} compact/><p className="mt-1 text-xs text-[var(--muted)]">Ao confirmar, entra na bancada.</p></>}</div>
    {canEdit && <details className="col-span-2 xl:col-span-4"><summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-[var(--link)]">Previsão e pedido · ver / editar</summary>
     <form className="grid gap-3 rounded-lg bg-[var(--background)] p-3 md:grid-cols-2" onSubmit={event=>{
      event.preventDefault();if(pending)return;const data=new FormData(event.currentTarget);
      start(async()=>{setError(null);setMessage(null);try{const result=await updateLensForecast(row.id,String(data.get("date")||"")||null,String(data.get("ref")||"")||null);if(!result.ok){setError(result.message);return;}setMessage(result.message??"Pedido atualizado.");router.refresh();}catch{setError("Não foi possível salvar. Confira a conexão e tente novamente.");}});
     }}>
      <Field label="Previsão de chegada das lentes"><Input name="date" type="date" defaultValue={row.lens_expected_at?ymd.format(new Date(row.lens_expected_at)):""} disabled={pending}/></Field>
      <Field label="Número do pedido no fornecedor"><Input name="ref" maxLength={60} defaultValue={row.lens_supplier_ref??""} disabled={pending}/></Field>
      <Button type="submit" variant="secondary" disabled={pending}>{pending?"Salvando…":"Salvar pedido de lentes"}</Button><Feedback error={error} message={message}/>
     </form>
    </details>}
   </div>
  </div>
 </li>;
}
export function LensBoard({rows,canEdit,canRelease,nowIso}:{rows:LensQueueRow[];canEdit:boolean;canRelease:boolean;nowIso:string}) {
 const router=useRouter();const[clock,setClock]=useState(nowIso);const now=useMemo(()=>new Date(clock),[clock]);
 const[filter,setFilter]=useState<LensRisk|"todas">("todas");const[query,setQuery]=useState("");const[seller,setSeller]=useState("");const[selected,setSelected]=useState<Set<string>>(new Set());const[pending,start]=useTransition();
 useEffect(()=>{const tick=()=>setClock(new Date().toISOString());const timer=window.setInterval(tick,60000);window.addEventListener("focus",tick);return()=>{window.clearInterval(timer);window.removeEventListener("focus",tick);};},[]);
 const withRisk=useMemo(()=>sortLensPriority(rows,now).map(row=>({row,risk:lensRisk({dueAt:row.due_at,lensExpectedAt:row.lens_expected_at,now}).risk})),[rows,now]);
 const counts=withRisk.reduce<Record<string,number>>((acc,item)=>({...acc,[item.risk]:(acc[item.risk]??0)+1}),{});
 const text=query.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
 const visible=withRisk.filter(({row,risk})=>(filter==="todas"||risk===filter)&&(!seller||(row.seller_name||"Sem vendedora")===seller)&&(!text||`${row.number} ${row.external_order_id??""} ${row.client_name} ${row.seller_name??""} ${row.store_name??""} ${row.laboratory_name} ${row.lens_supplier_ref??""}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(text)));
 const selectedIds=visible.filter(({row})=>selected.has(row.id)).map(({row})=>row.id).slice(0,100);
 function changeFilter(next:LensRisk|"todas"){setFilter(next);setSelected(new Set());}
 function release(){if(pending||!selectedIds.length)return;start(async()=>{try{const result=await quickMoveOrders(selectedIds,"aguardando_montagem","Lentes recebidas e encaminhadas à bancada");setSelected(new Set(result.results.filter(item=>!item.ok).map(item=>item.id)));if(result.ok)toast.success(`${result.message} Conferir na bancada de montagem.`);if(result.results.some(item=>!item.ok)||!result.ok)toast.error(result.results.find(item=>!item.ok)?.message||result.message);router.refresh();}catch{toast.error("Falha na conexão. Confira o resultado antes de tentar novamente.");}});}
 const chips:(LensRisk|"todas")[]=["todas","lente_atrasada","vai_atrasar","apertado","sem_previsao","ok","sem_prazo"];
 return <section className="grid gap-3" aria-label="Lista de lentes por prioridade">
  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"><p className="text-sm font-semibold">Maior urgência primeiro</p><p className="mt-1 text-xs text-[var(--muted)]">Atraso do cliente → prioridade crítica → risco de atraso → chegada pendente e prazo próximo → demais OS. Dentro do mesmo nível, o prazo mais próximo fica acima.</p></div>
  <div className="flex flex-wrap items-end gap-3"><label className="text-xs font-semibold">Vendedora<select value={seller} onChange={event=>{setSeller(event.target.value);setSelected(new Set());}} className="mt-1 block min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3"><option value="">Todas as vendedoras</option>{Array.from(new Set(rows.map(row=>row.seller_name||"Sem vendedora"))).sort().map(name=><option key={name}>{name}</option>)}</select></label>
  <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3"><Search size={17}/><input aria-label="Buscar OS, cliente, vendedora ou pedido" value={query} onChange={event=>{setQuery(event.target.value);setSelected(new Set());}} placeholder="OS, cliente, vendedora ou pedido" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label></div>
  <div className="flex flex-wrap gap-2">{chips.filter(key=>key==="todas"||counts[key]).map(key=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>changeFilter(key)} className={`min-h-11 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold ${filter===key?"bg-[var(--solid-ink)] text-white":"bg-[var(--surface)] text-[var(--muted)]"}`}>{key==="todas"?"Todas":LENS_RISK[key].label} <span className="font-mono">{key==="todas"?rows.length:counts[key]}</span></button>)}</div>
  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2"><label className="flex min-h-11 items-center gap-2 text-xs font-semibold"><input type="checkbox" disabled={pending||!visible.length} checked={visible.length>0&&visible.slice(0,100).every(({row})=>selected.has(row.id))} onChange={event=>setSelected(event.target.checked?new Set(visible.slice(0,100).map(({row})=>row.id)):new Set())}/>Selecionar até 100 OS visíveis</label><span className="ml-auto text-xs text-[var(--muted)]">{visible.length} OS · lista por prioridade</span></div>
  {selectedIds.length>0 && <div className="sticky top-[68px] z-10 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--focus)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)]"><span className="mr-auto text-sm font-semibold">{selectedIds.length} selecionadas</span><Button size="sm" variant="ghost" disabled={pending} onClick={()=>setSelected(new Set())}>Limpar seleção</Button><Button size="sm" variant="secondary" asChild><Link href={`/laboratorio/etiquetas?ids=${selectedIds.join(",")}`}><Printer size={16}/>Imprimir etiquetas</Link></Button>{canRelease&&<Button size="sm" disabled={pending} onClick={release}><PackageOpen size={16}/>{pending?"Enviando…":"Lentes chegaram → bancada"}</Button>}</div>}
  {rows.length>=500&&<p className="text-xs text-[var(--warning)]">Exibindo até 500 OS carregadas. Use os filtros para localizar o serviço desejado.</p>}
  {visible.length?<ol className="grid gap-2">{visible.map(({row},index)=><LensLine key={row.id} row={row} now={now} index={index} canEdit={canEdit} canRelease={canRelease} disabled={pending} selected={selected.has(row.id)} onToggle={()=>{if(!selected.has(row.id)&&selectedIds.length>=100){toast.error("Selecione até 100 OS por lote.");return;}setSelected(current=>{const next=new Set(current);if(next.has(row.id))next.delete(row.id);else next.add(row.id);return next;});}}/>)}</ol>:<p className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">Nenhuma OS aguardando lente neste filtro.</p>}
 </section>;
}
