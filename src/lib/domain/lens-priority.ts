import { lensRisk } from "./flow";
export type LensPriorityInput = { id: string; due_at: string | null; lens_expected_at: string | null; priority: "normal" | "critica"; entered_at: string };
export function lensPriority(row: LensPriorityInput, now: Date) {
 const due = row.due_at ? Date.parse(row.due_at) : NaN;
 const hours = (due-now.getTime())/3600000;
 const risk = lensRisk({dueAt:row.due_at,lensExpectedAt:row.lens_expected_at,now}).risk;
 if (Number.isFinite(hours) && hours<0) return {level:"late",rank:0,label:"Entrega ao cliente atrasada"} as const;
 if (row.priority==="critica") return {level:"critical",rank:1,label:"Prioridade crítica"} as const;
 if (Number.isFinite(hours) && hours<=4) return {level:"critical",rank:2,label:"Entrega em até 4h"} as const;
 if (risk==="vai_atrasar") return {level:"critical",rank:2,label:"Risco de atraso ao cliente"} as const;
 if (Number.isFinite(hours) && hours<=24) return {level:"critical",rank:2,label:"Entrega em até 24h"} as const;
 if (risk==="lente_atrasada") return {level:"soon",rank:3,label:"Cobrar chegada da lente"} as const;
 if ((Number.isFinite(hours) && hours<=48) || risk==="apertado") return {level:"attention",rank:4,label:"Prazo próximo"} as const;
 if (!Number.isFinite(hours)) return {level:"none",rank:6,label:"Sem prazo do cliente"} as const;
 return {level:"normal",rank:5,label:"No prazo"} as const;
}
export function sortLensPriority<T extends LensPriorityInput>(rows: T[], now: Date): T[] {
 const due=(row:T)=>row.due_at && Number.isFinite(Date.parse(row.due_at))?Date.parse(row.due_at):Infinity;
 return [...rows].sort((a,b)=>lensPriority(a,now).rank-lensPriority(b,now).rank || (due(a)-due(b) || 0) || a.entered_at.localeCompare(b.entered_at) || a.id.localeCompare(b.id));
}
