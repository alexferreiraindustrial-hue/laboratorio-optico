"use client";
import { ChevronDown, PackageOpen, Printer, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addDays, zonedYmd } from "@/lib/domain/calendar";
import {waitingForFrame,FRAME_LABEL} from "@/lib/domain/operations";
import {OrderOperationsEditor} from "./order-operations";
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
 const vta=waitingForFrame(row);
 const tone=vta?{label:"VTA · aguardando armação",fg:"var(--warning)",bg:"var(--warning-soft)"}:LENS_RISK[risk.risk];
 const [expanded,setExpanded]=useState(false);
 const [pending,start]=useTransition();const[error,setError]=useState<string|null>(null);const[message,setMessage]=useState<string|null>(null);
 const panelId=`lens-edit-${row.id}`;
 return <li className="lens-priority-row lens-list-row" data-urgency={priority.level}>
  <div className="lens-list-grid">
   <label className="lens-list-select flex min-h-11 items-center justify-center"><input type="checkbox" checked={selected} disabled={disabled} onChange={onToggle} aria-label={`Selecionar OS ${visibleOrderNumber(row)}`} className="h-4 w-4"/></label>
   <Link href={`/lentes?os=${row.id}`} scroll={false} className="lens-list-client min-w-0 py-1" title={`Abrir OS ${visibleOrderNumber(row)} — ${row.client_name}`}><span className="block truncate text-xs font-semibold text-[var(--link)]"><span className="mr-2 font-normal text-[var(--muted)]">{index+1}.</span>OS {visibleOrderNumber(row)}</span><span className="mt-0.5 block truncate text-sm font-semibold text-[var(--ink)]">{row.client_name}</span>{row.frame_state&&row.frame_state!=="unknown"&&<span className="block truncate text-[10px] text-[var(--muted)]">{FRAME_LABEL[row.frame_state]}</span>}</Link>
   <div className="lens-list-supplier min-w-0 text-xs"><p className="truncate font-medium" title={row.seller_name||"Sem vendedora"}>{row.seller_name||"Sem vendedora"}</p><p className="mt-1 truncate text-[var(--muted)]" title={row.laboratory_name||"Laboratório não informado"}>{row.laboratory_name||"Laboratório não informado"}</p></div>
   <div className="lens-list-deadline min-w-0 text-xs"><p className="font-semibold">{row.due_at?formatDateTime(row.due_at):"Sem prazo"}</p><span className="lens-priority-badge mt-1 inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-semibold" title={row.due_at?dueDeltaLabel(row.due_at,now,"aguardando_lentes"):priority.label}>{priority.label}</span></div>
   <div className="lens-list-forecast min-w-0 text-xs"><p className="text-[var(--muted)]">{vta?"Lente recebida":row.lens_expected_at?formatDateTime(row.lens_expected_at):"Sem previsão"}</p><span className="mt-1 inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-medium" style={{color:tone.fg,background:tone.bg}} title={tone.label}>{tone.label}</span></div>
   <div className="lens-list-actions flex items-center justify-end gap-1">{canRelease&&!vta&&<LensArrival orderId={row.id} showLaboratory={false} compact dense/>}<button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={()=>setExpanded(value=>!value)} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[var(--link)] hover:bg-[var(--accent-soft)]"><span>{expanded?"Fechar":vta?"Receber armação":canEdit?"Editar":"Mais"}</span><ChevronDown size={15} className={expanded?"rotate-180":""}/></button></div>
  </div>
  <div id={panelId} hidden={!expanded} className="lens-list-expanded border-t border-[var(--line)] bg-[var(--background)] px-4 py-3">
   <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--muted)]"><span>Cliente: <strong className="text-[var(--ink)]">{row.client_name}</strong></span><span>Vendedora: {row.seller_name||"Não informada"}{row.store_name?` · ${row.store_name}`:""}</span><span>Laboratório: {row.laboratory_name||"Não informado"}</span>{row.due_at&&<span className="lens-priority-text font-semibold">{dueDeltaLabel(row.due_at,now,"aguardando_lentes")}</span>}</div>
   {canEdit?<div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_2fr]"><OrderLaboratory orderId={row.id}/><form className="grid items-end gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]" onSubmit={event=>{
      event.preventDefault();if(pending)return;const data=new FormData(event.currentTarget);
      start(async()=>{setError(null);setMessage(null);try{const result=await updateLensForecast(row.id,String(data.get("date")||"")||null,String(data.get("ref")||"")||null);if(!result.ok){setError(result.message);return;}setMessage(result.message??"Pedido atualizado.");router.refresh();}catch{setError("Não foi possível salvar. Confira a conexão e tente novamente.");}});
     }}>
      <Field label="Previsão de chegada"><Input name="date" type="date" defaultValue={row.lens_expected_at?ymd.format(new Date(row.lens_expected_at)):""} disabled={pending}/></Field>
      <Field label="Pedido no fornecedor"><Input name="ref" maxLength={60} defaultValue={row.lens_supplier_ref??""} disabled={pending}/></Field>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>{pending?"Salvando…":"Salvar pedido"}</Button><div className="col-span-full"><Feedback error={error} message={message}/></div>
     </form></div>:<p className="text-xs text-[var(--muted)]">Pedido no fornecedor: {row.lens_supplier_ref||"Não informado"}</p>}
   {canEdit&&<div className="mt-3"><OrderOperationsEditor key={row.updated_at} id={row.id} operations={row} status="aguardando_lentes"/></div>}
  </div>
 </li>;
}
export function LensBoard({rows,canEdit,canRelease,nowIso}:{rows:LensQueueRow[];canEdit:boolean;canRelease:boolean;nowIso:string}) {
 const router=useRouter();const[clock,setClock]=useState(nowIso);const now=useMemo(()=>new Date(clock),[clock]);
 const[lane,setLane]=useState<"lenses"|"vta">("lenses");
 const queueRows=useMemo(()=>rows.filter(row=>waitingForFrame(row)===(lane==="vta")),[rows,lane]);
 const[filter,setFilter]=useState<LensRisk|"todas">("todas");const[query,setQuery]=useState("");const[seller,setSeller]=useState("");const[selected,setSelected]=useState<Set<string>>(new Set());const[pending,start]=useTransition();
 useEffect(()=>{const tick=()=>setClock(new Date().toISOString());const timer=window.setInterval(tick,60000);window.addEventListener("focus",tick);return()=>{window.clearInterval(timer);window.removeEventListener("focus",tick);};},[]);
 const withRisk=useMemo(()=>sortLensPriority(queueRows,now).map(row=>({row,risk:lensRisk({dueAt:row.due_at,lensExpectedAt:row.lens_expected_at,now}).risk})),[queueRows,now]);
 const counts=withRisk.reduce<Record<string,number>>((acc,item)=>({...acc,[item.risk]:(acc[item.risk]??0)+1}),{});
 const text=query.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
 const visible=withRisk.filter(({row,risk})=>(filter==="todas"||risk===filter)&&(!seller||(row.seller_name||"Sem vendedora")===seller)&&(!text||`${row.number} ${row.external_order_id??""} ${row.client_name} ${row.seller_name??""} ${row.store_name??""} ${row.laboratory_name} ${row.lens_supplier_ref??""}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(text)));
 const selectedIds=visible.filter(({row})=>selected.has(row.id)).map(({row})=>row.id).slice(0,100);
 function changeFilter(next:LensRisk|"todas"){setFilter(next);setSelected(new Set());}
 function release(){if(pending||!selectedIds.length)return;start(async()=>{try{const result=await quickMoveOrders(selectedIds,"aguardando_montagem","Lentes recebidas e encaminhadas à bancada");setSelected(new Set(result.results.filter(item=>!item.ok).map(item=>item.id)));if(result.ok)toast.success(result.message);if(result.results.some(item=>!item.ok)||!result.ok)toast.error(result.results.find(item=>!item.ok)?.message||result.message);router.refresh();}catch{toast.error("Falha na conexão. Confira o resultado antes de tentar novamente.");}});}
 const chips:(LensRisk|"todas")[]=["todas","lente_atrasada","vai_atrasar","apertado","sem_previsao","ok","sem_prazo"];
 return <section className="lab-operational-filters grid gap-2" aria-label="Lista de lentes por prioridade">
  <div className="flex flex-wrap gap-2">{(["lenses","vta"] as const).map(key=><button type="button" key={key} aria-pressed={lane===key} onClick={()=>{setLane(key);setFilter("todas");setSelected(new Set());}} className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${lane===key?"border-[var(--accent)] bg-[var(--accent)] text-white":"border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"}`}>{key==="vta"?"VTA · lente recebida":"Lentes a chegar"} <span className="font-mono">{rows.filter(row=>waitingForFrame(row)===(key==="vta")).length}</span></button>)}<Link href="/avisos" className="ml-auto flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--link)]">Gerar avisos por vendedora →</Link></div>
  {lane==="lenses"&&<LensArrivalWeek rows={queueRows} now={now}/>}
  <p className="text-xs text-[var(--muted)]">Ordenado por urgência · atrasadas e prazos mais próximos primeiro.</p>
  <div className="flex flex-wrap items-end gap-3"><label className="text-xs font-semibold">Vendedora<select value={seller} onChange={event=>{setSeller(event.target.value);setSelected(new Set());}} className="mt-1 block min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3"><option value="">Todas as vendedoras</option>{Array.from(new Set(rows.map(row=>row.seller_name||"Sem vendedora"))).sort().map(name=><option key={name}>{name}</option>)}</select></label>
  <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3"><Search size={17}/><input aria-label="Buscar OS, cliente, vendedora ou pedido" value={query} onChange={event=>{setQuery(event.target.value);setSelected(new Set());}} placeholder="OS, cliente, vendedora ou pedido" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label></div>
  {lane!=="vta"&&<div className="flex flex-wrap gap-2">{chips.filter(key=>key==="todas"||counts[key]).map(key=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>changeFilter(key)} className={`min-h-11 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold ${filter===key?"bg-[var(--solid-ink)] text-white":"bg-[var(--surface)] text-[var(--muted)]"}`}>{key==="todas"?"Todas":LENS_RISK[key].label} <span className="font-mono">{key==="todas"?queueRows.length:counts[key]}</span></button>)}</div>}
  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2"><label className="flex min-h-11 items-center gap-2 text-xs font-semibold"><input type="checkbox" disabled={pending||!visible.length} checked={visible.length>0&&visible.slice(0,100).every(({row})=>selected.has(row.id))} onChange={event=>setSelected(event.target.checked?new Set(visible.slice(0,100).map(({row})=>row.id)):new Set())}/>Selecionar até 100 OS visíveis</label><span className="ml-auto text-xs text-[var(--muted)]">{visible.length} OS · lista por prioridade</span></div>
  {selectedIds.length>0 && <div className="lg-selection-bar sticky top-[68px] z-10 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--focus)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)]"><span className="mr-auto text-sm font-semibold">{selectedIds.length} selecionadas</span><Button size="sm" variant="ghost" disabled={pending} onClick={()=>setSelected(new Set())}>Limpar seleção</Button><Button size="sm" variant="secondary" asChild><Link href={`/laboratorio/etiquetas?ids=${selectedIds.join(",")}`}><Printer size={16}/>Imprimir etiquetas</Link></Button>{canRelease&&lane!=="vta"&&<Button size="sm" disabled={pending} onClick={release}><PackageOpen size={16}/>{pending?"Enviando…":"Lentes chegaram → bancada"}</Button>}</div>}
  {rows.length>=500&&<p className="text-xs text-[var(--warning)]">Exibindo até 500 OS carregadas. Use os filtros para localizar o serviço desejado.</p>}
  {visible.length?<div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]"><div className="lens-list-grid lens-list-heading" aria-hidden="true"><span/><span>OS / Cliente</span><span>Vendedora / Laboratório</span><span>Prazo do cliente</span><span>Chegada prevista</span><span className="text-right">Ações</span></div><ol>{visible.map(({row},index)=><LensLine key={row.id} row={row} now={now} index={index} canEdit={canEdit} canRelease={canRelease} disabled={pending} selected={selected.has(row.id)} onToggle={()=>{if(!selected.has(row.id)&&selectedIds.length>=100){toast.error("Selecione até 100 OS por lote.");return;}setSelected(current=>{const next=new Set(current);if(next.has(row.id))next.delete(row.id);else next.add(row.id);return next;});}}/>)}</ol></div>:<p className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">Nenhuma OS aguardando lente neste filtro.</p>}
 </section>;
}

function LensArrivalWeek({rows,now}:{rows:LensQueueRow[];now:Date}) {
 const today=zonedYmd(now);
 const counts=new Map<string,number>();
 for(const row of rows)if(row.lens_expected_at){const key=zonedYmd(new Date(row.lens_expected_at));counts.set(key,(counts.get(key)||0)+1);}
 return <details className="lg-glass rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-semibold"><span>Chegadas previstas · próximos 7 dias</span><span className="text-xs font-normal text-[var(--muted)]">Ver semana</span></summary><ol className="lg-week mt-2" aria-label="Lentes previstas por dia">{Array.from({length:7},(_,i)=>{const key=addDays(today,i);const date=new Date(`${key}T12:00:00Z`);const count=counts.get(key)||0;return <li key={key} className="lg-week-day" data-today={key===today}><span className="block text-xs text-[var(--muted)]">{i===0?"Hoje":date.toLocaleDateString("pt-BR",{weekday:"short",timeZone:"America/Sao_Paulo"})}</span><span className="my-1 block font-mono text-sm font-semibold">{date.getUTCDate()}</span><span className="block text-xs text-[var(--link)]" aria-label={`${count} lentes previstas`}>{count}</span></li>;})}</ol><p className="mt-2 text-xs text-[var(--muted)]">Previsões das OS carregadas, no horário de Brasília.</p></details>;
}
