import { describe, expect, it } from "vitest";
import { validateGuidedEntry } from "./guided-entry";
import { dateTimeLocalToIso } from "./calendar";

const now = new Date("2026-11-19T12:00:00Z");
const input = { laboratoryId: "lab", sellerId: "seller", storeId: "", orderRef: "4521", clientName: "", dueAt: "2026-11-20T18:00:00Z" };

describe("cadastro guiado", () => {
  it("permite começar sem cliente nem loja, preservando o cadastro rápido", () => {
    expect(validateGuidedEntry(input, now)).toBeNull();
  });
  it("exige laboratório, vendedor e o número do papel", () => {
    for (const key of ["laboratoryId", "sellerId", "orderRef"] as const) {
      expect(validateGuidedEntry({ ...input, [key]: "" }, now)).not.toBeNull();
    }
    expect(validateGuidedEntry({ ...input, orderRef: "   " }, now)).not.toBeNull();
  });
  it("não aceita prazo vazio, inválido, passado ou igual ao instante do cadastro", () => {
    for (const dueAt of ["", "inválido", "2026-11-18T12:00:00Z", now.toISOString()]) {
      expect(validateGuidedEntry({ ...input, dueAt }, now)).not.toBeNull();
    }
  });
  it("interpreta o prazo prometido no horário de Brasília", () => {
    const dueAt = dateTimeLocalToIso("2026-11-20T15:00");
    expect(dueAt).toBe("2026-11-20T18:00:00.000Z");
    expect(validateGuidedEntry({ ...input, dueAt }, now)).toBeNull();
  });
});

describe("manutenção sem OS",()=>{
 const maintenance={...input,serviceKind:"manutencao" as const,laboratoryId:"",orderRef:"",clientName:"",serviceDescription:"Troca de plaquetas"};
 it("aceita manutenção sem OS, cliente ou fornecedor externo",()=>{expect(validateGuidedEntry(maintenance,now)).toBeNull();});
 it("continua exigindo responsável, descrição e prazo válido",()=>{
  expect(validateGuidedEntry({...maintenance,sellerId:""},now)).not.toBeNull();
  for(const serviceDescription of ["","  ","ab","x".repeat(501)])expect(validateGuidedEntry({...maintenance,serviceDescription},now)).not.toBeNull();
  expect(validateGuidedEntry({...maintenance,dueAt:now.toISOString()},now)).not.toBeNull();
 });
 it("não dispensa a OS de pedidos de lentes e rejeita tipo inválido",()=>{
  expect(validateGuidedEntry({...maintenance,serviceKind:"lentes",laboratoryId:"lab"},now)).toContain("número da OS");
  expect(validateGuidedEntry({...input,serviceKind:"outro" as "lentes"},now)).toContain("tipo de serviço");
 });
 it("limita a identificação do cliente e a OS",()=>{
  expect(validateGuidedEntry({...maintenance,clientName:"x".repeat(201)},now)).not.toBeNull();
  expect(validateGuidedEntry({...maintenance,orderRef:"x".repeat(81)},now)).not.toBeNull();
 });
});
