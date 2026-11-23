import { describe, expect, it } from "vitest";
import { benchDeadlineSignal, nextBenchAction, selectBenchOrders, type BenchOrder } from "./bench";
import { STEP_KEYS } from "./constants";

const now = new Date("2026-11-16T12:00:00Z");
const options = { query: "", focus: "all", assigneeId: "", sort: "risk", userId: "operator" } as const;
const base: BenchOrder = {
  id: "a", number: "OS-2026-000001", externalOrderId: "123", clientName: "João Costa", laboratoryName: "Central",
  sellerName: "Márcia", storeName: "Centro", dueAt: "2026-11-20T12:00:00Z", enteredAt: "2026-11-15T12:00:00Z",
  status: "em_montagem", urgent: false, openOccurrences: 0,
  steps: STEP_KEYS.map((key) => ({ key, status: "pendente", startedAt: null, assignee: null, assigneeId: null })),
};
const order = (values: Partial<BenchOrder> = {}): BenchOrder => ({ ...base, ...values });
const complete = base.steps.map((step) => ({ ...step, status: "concluida" as const }));

describe("próxima ação da bancada", () => {
  it("inicia a montagem antes das etapas e respeita perfil de consulta", () => {
    expect(nextBenchAction(order({ status: "aguardando_montagem" }), "montador")).toMatchObject({ kind: "status", to: "em_montagem" });
    expect(nextBenchAction(base, "consulta").kind).toBe("none");
  });
  it("propõe iniciar e concluir apenas a primeira etapa pendente na sequência", () => {
    expect(nextBenchAction(base, "montador")).toMatchObject({ kind: "step", step: "conferencia_inicial", action: "iniciar" });
    const steps = base.steps.map((step, index) => ({ ...step, status: index === 0 ? "concluida" as const : index === 1 ? "em_andamento" as const : "pendente" as const }));
    expect(nextBenchAction(order({ steps }), "montador")).toMatchObject({ step: "lensometria", action: "concluir" });
  });
  it("retoma OS em correção antes de oferecer avanço das etapas", () => {
    expect(nextBenchAction(order({ status: "em_correcao" }), "montador")).toMatchObject({ kind: "status", to: "em_montagem" });
  });
  it("não oferece liberação quando faltam etapas carregadas ou existem ocorrências", () => {
    expect(nextBenchAction(order({ status: "em_conferencia", steps: [] }), "admin").kind).toBe("none");
    for (const openOccurrences of [1, null]) {
      expect(nextBenchAction(order({ status: "em_conferencia", steps: complete, openOccurrences }), "admin").kind).toBe("none");
    }
    expect(nextBenchAction(order({ status: "em_conferencia", steps: complete }), "montador")).toMatchObject({ kind: "status", to: "pronto" });
  });
  it("encaminha somente serviços marcados ao médico e mantém os demais no fluxo normal", () => {
    expect(nextBenchAction(order({ steps: complete }), "montador")).toMatchObject({ kind: "status", to: "pronto" });
    expect(nextBenchAction(order({ steps: complete,medical_review_required:true }), "montador")).toMatchObject({ kind: "status", to: "em_conferencia" });
    expect(nextBenchAction(order({status:"em_conferencia",steps:complete,medical_review_required:true}),"montador").kind).toBe("none");
  });
});

describe("organização da bancada", () => {
  it("prioriza atraso e preserva o array original", () => {
    const rows = [base, order({ id: "late", dueAt: "2026-11-16T11:00:00Z" })];
    expect(selectBenchOrders(rows, options, now).map((row) => row.id)).toEqual(["late", "a"]);
    expect(rows[0].id).toBe("a");
  });
  it("busca sem acentos e reconhece número externo", () => {
    for (const query of ["joao", "marcia", "123"]) expect(selectBenchOrders([base], { ...options, query }, now)).toHaveLength(1);
  });
  it("minhas etapas considera só o responsável em execução, não etapas históricas", () => {
    const historical = order({ id: "past", steps: base.steps.map((step) => ({ ...step, status: "concluida", assigneeId: "operator" })) });
    const running = order({ id: "current", steps: base.steps.map((step, index) => index === 0 ? { ...step, status: "em_andamento", assigneeId: "operator", assignee: "Alex" } : step) });
    expect(selectBenchOrders([historical, running], { ...options, focus: "mine" }, now).map((row) => row.id)).toEqual(["current"]);
    expect(selectBenchOrders([historical, running], { ...options, focus: "unassigned" }, now).map((row) => row.id)).toEqual(["past"]);
    expect(selectBenchOrders([running], { ...options, focus: "mine", userId: "" }, now)).toEqual([]);
  });
});

describe("sinalização do prazo no cartão compacto",()=>{
 const withHours=(hours:number)=>order({dueAt:new Date(now.getTime()+hours*3600000).toISOString(),steps:complete,status:"em_conferencia"});
 it("avança de normal para amarelo, laranja, vermelho e atraso nos limites",()=>{
  for(const [hours,level] of [[49,"normal"],[48,"attention"],[24,"soon"],[4,"critical"],[0,"critical"],[-.01,"late"]] as const) expect(benchDeadlineSignal(withHours(hours),now).level).toBe(level);
 });
 it("destaca prioridade crítica mesmo longe do prazo ou sem prazo",()=>{
  expect(benchDeadlineSignal({...withHours(100),urgent:true},now).level).toBe("critical");
  expect(benchDeadlineSignal(order({dueAt:null,urgent:true}),now).label).toBe("Prioridade crítica");
 });
 it("não inventa um prazo para data ausente ou inválida",()=>{
  for(const dueAt of [null,"inválida"]) expect(benchDeadlineSignal(order({dueAt}),now)).toMatchObject({level:"none",label:"Sem prazo informado"});
 });
 it("alerta risco de trabalho restante antes de vencer e mantém atraso acima da prioridade",()=>{
  const atRisk=order({status:"aguardando_montagem",dueAt:new Date(now.getTime()+5*3600000).toISOString(),steps:base.steps});
  expect(benchDeadlineSignal(atRisk,now).level).toBe("critical");
  expect(benchDeadlineSignal({...withHours(-1),urgent:true},now).level).toBe("late");
 });
});
