"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, LayoutList, RefreshCw, Workflow, Zap } from "lucide-react";
import { QUEUE_STATUSES, STATUS_LABEL, type OrderStatus } from "@/lib/domain/constants";
import { formatDateTime } from "@/lib/format";
import { stageStyle, StepTrack } from "./production-visuals";

export type OverviewOrder = { id:string; number:string; clientName:string; status:OrderStatus; dueAt:string|null; sellerName:string|null; stepsDone:number };
export function ProductionOverview({orders,canLaunch}:{orders:OverviewOrder[];canLaunch:boolean}) {
 const [view,setView]=useState<"kanban"|"list"|"timeline">("kanban");
 const [pending,start]=useTransition();const router=useRouter();
 const sorted=[...orders].sort((a,b)=>(a.dueAt||"9999").localeCompare(b.dueAt||"9999"));
 return <div className="lg-overview">
  <section className="lg-glass min-w-0 rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--surface)] p-4">
   <header className="mb-4 flex flex-wrap items-center gap-3"><h2 className="mr-auto flex items-center gap-2 text-base font-bold"><Workflow size={19} className="text-[var(--link)]"/>Linha de produção</h2><div className="flex gap-1 rounded-xl bg-[var(--surface-secondary)] p-1" role="group" aria-label="Visão da linha de produção">{([['kanban','Kanban'],['list','Lista'],['timeline','Por prazo']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={view===key} onClick={()=>setView(key)} className={`min-h-11 rounded-lg px-3 text-xs font-semibold ${view===key?'lg-gold bg-[var(--accent)] text-[var(--on-accent)]':'text-[var(--muted)]'}`}>{label}</button>)}</div><button type="button" aria-label="Atualizar produção" title="Atualizar produção" disabled={pending} onClick={()=>start(()=>router.refresh())} className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)]"><RefreshCw size={17} className={pending?"animate-spin":""}/></button><Link href="/laboratorio?view=kanban" aria-label="Abrir quadro completo" className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)]"><ArrowUpRight size={18}/></Link></header>
   {view==="kanban"?<div className="lg-preview-columns">{QUEUE_STATUSES.map(status=>{const list=orders.filter(o=>o.status===status);return <section key={status} className="lg-lane rounded-xl border border-[var(--line)] bg-[var(--background)]" style={stageStyle(status)}><h3 className="flex min-h-11 items-center gap-2 text-xs font-semibold"><span className="lg-stage-dot h-2 w-2 rounded-full"/>{STATUS_LABEL[status]}<span className="ml-auto font-mono">{list.length}</span></h3>{list.slice(0,2).map(o=><Link key={o.id} href={`/laboratorio?os=${o.id}`} className="lg-preview-card block rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2"><span className="font-mono text-xs font-semibold text-[var(--link)]">OS {o.number}</span><p className="my-1 truncate text-sm font-semibold">{o.clientName}</p><p className="mb-2 truncate text-xs text-[var(--muted)]">{o.sellerName||"Sem vendedora"}</p><StepTrack done={o.stepsDone}/></Link>)}{!list.length&&<p className="py-3 text-xs text-[var(--muted)]">Fila vazia</p>}<Link href={`/laboratorio/fila/${status}`} className="mt-2 flex min-h-11 items-center text-xs font-semibold text-[var(--link)]">Ver fila completa →</Link></section>;})}</div>:<ol className="divide-y divide-[var(--line)]">{sorted.slice(0,12).map(o=><li key={o.id}><Link href={`/laboratorio?os=${o.id}`} className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 py-3"><span className="min-w-24 font-mono text-xs text-[var(--link)]">{view==="timeline"?formatDateTime(o.dueAt):`OS ${o.number}`}</span><span className="min-w-0 flex-1 text-sm font-semibold">{o.clientName}<span className="mt-1 block text-xs font-normal text-[var(--muted)]">{o.sellerName||"Sem vendedora"} · {view==="timeline"?`OS ${o.number}`:formatDateTime(o.dueAt)}</span></span><span className="text-xs text-[var(--muted)]">{STATUS_LABEL[o.status]}</span></Link></li>)}{!orders.length&&<li className="py-8 text-center text-sm text-[var(--muted)]">Nenhum serviço na fila.</li>}</ol>}
   <p className="mt-2 text-xs text-[var(--muted)]">{orders.length} OS carregadas · {view==="kanban"?"até 2 por coluna":"até 12 por prazo"}. Use Atualizar para consultar o andamento.</p>
  </section>
  <aside className="lg-glass overflow-hidden rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--surface)]">
   <div className="lg-hero-image" role="img" aria-label="Óculos com iluminação dourada e azul"/>
   <div className="lg-assistance-links"><h2 className="text-base font-bold text-[var(--ink)]">Atalhos da operação</h2><p className="text-xs text-[var(--muted)]">Tudo para continuar o próximo serviço.</p>{canLaunch&&<Link href="/laboratorio/rapido" className="lg-gold"><span className="flex items-center gap-2"><Zap size={16}/>Modo rápido</span><ArrowUpRight size={16}/></Link>}<Link href="/avisos"><span>Avisos por vendedora</span><ArrowUpRight size={16}/></Link><Link href="/montagem"><span>Bancada de montagem</span><ArrowUpRight size={16}/></Link><Link href="/rotina"><span>Rotina do dia</span><LayoutList size={16}/></Link></div>
  </aside>
 </div>;
}

export function ProductionSummary({stages,total}:{stages:{status:OrderStatus;count:number;note:string;alert:boolean}[];total:number}) {
 return <section className="lg-dashboard-summary" aria-label="Resumo da produção">{stages.map(stage=><Link key={stage.status} href={`/laboratorio/fila/${stage.status}`} style={stageStyle(stage.status)}><span className="flex items-center gap-2 text-xs font-semibold"><span className="lg-stage-dot h-2 w-2 rounded-full"/>{STATUS_LABEL[stage.status]}</span><strong className="tabular">{stage.count}</strong><p className={`mb-3 text-xs ${stage.alert?"text-[var(--danger)]":"text-[var(--muted)]"}`}>{stage.note}</p><div className="lg-bar"><span style={{width:`${total?Math.max(3,stage.count/total*100):0}%`}}/></div></Link>)}</section>;
}

export function ProductionGoal({done,goal}:{done:number;goal:number|null}) {
 const pct=goal&&goal>0?Math.min(100,done/goal*100):0;
 return <svg viewBox="0 0 120 120" width="112" height="112" role="img" aria-label={goal?`${done} de ${goal} montagens concluídas hoje`:"Meta diária não definida"} className="mx-auto my-3 shrink-0"><circle cx="60" cy="60" r="48" fill="none" stroke="var(--line)" strokeWidth="10"/><circle cx="60" cy="60" r="48" fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${pct*3.016} 301.6`} transform="rotate(-90 60 60)"/><text x="60" y="58" textAnchor="middle" fill="var(--ink)" fontSize="26" fontWeight="800">{done}</text><text x="60" y="79" textAnchor="middle" fill="var(--muted)" fontSize="12">{goal?`meta ${goal}`:"sem meta"}</text></svg>;
}
