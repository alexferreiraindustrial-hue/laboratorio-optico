import { describe, expect, it } from "vitest";
import { lensPriority, sortLensPriority, type LensPriorityInput } from "./lens-priority";
const now=new Date("2026-11-21T12:00:00Z");
const at=(hours:number)=>new Date(now.getTime()+hours*3600000).toISOString();
const row=(id:string,patch:Partial<LensPriorityInput>={}):LensPriorityInput=>({id,due_at:at(96),lens_expected_at:at(12),priority:"normal",entered_at:at(-24),...patch});
describe("ordem operacional da fila de lentes",()=>{
 it("coloca cliente atrasado antes de crítica, risco e prazo confortável",()=>{
  const rows=[row("normal"),row("critica",{priority:"critica",due_at:at(200)}),row("atrasada",{due_at:at(-1)}),row("risco",{due_at:at(20),lens_expected_at:null})];
  expect(sortLensPriority(rows,now).map(item=>item.id)).toEqual(["atrasada","critica","risco","normal"]);
  expect(rows[0].id).toBe("normal");
 });
 it("desempata por prazo mais próximo sem deixar previsão ausente esconder urgência",()=>{
  expect(sortLensPriority([row("24h",{due_at:at(24),lens_expected_at:null}),row("4h",{due_at:at(4),lens_expected_at:null})],now).map(item=>item.id)).toEqual(["4h","24h"]);
 });
 it("separa atraso da lente e atraso do cliente",()=>{
  const lensLate=row("lente",{due_at:at(100),lens_expected_at:at(-5)});
  expect(lensPriority(lensLate,now)).toMatchObject({level:"soon",label:"Cobrar chegada da lente"});
  expect(lensPriority({...lensLate,due_at:at(-1)},now).level).toBe("late");
 });
 it("trata falta de prazo e prioridade manual explicitamente",()=>{
  expect(lensPriority(row("sem",{due_at:null,lens_expected_at:null}),now).level).toBe("none");
  expect(lensPriority(row("urgente",{due_at:null,lens_expected_at:null,priority:"critica"}),now).level).toBe("critical");
 });
 it("atualiza a urgência quando o relógio ultrapassa o prazo",()=>{
  const order=row("hoje",{due_at:at(2),lens_expected_at:null});
  expect(lensPriority(order,now).level).toBe("critical");
  expect(lensPriority(order,new Date(at(3))).level).toBe("late");
 });
});
