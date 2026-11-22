import { beforeEach, describe, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({role:"admin",rpc:vi.fn(),resolve:vi.fn()}));
vi.mock("./session",()=>({requireProfile:async()=>({role:state.role,supabase:{rpc:state.rpc}}),actionError:(error:{message:string})=>error.message}));
vi.mock("./laboratory-resolution",()=>({resolveLaboratory:state.resolve}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { createGuidedOrder } from "./quick-actions";
import { INTERNAL_MAINTENANCE } from "@/lib/domain/laboratories";
const input={serviceKind:"manutencao" as const,serviceDescription:"Troca de parafuso",orderRef:"",clientName:"",sellerId:"seller",storeId:"",laboratoryId:"incorrect-external",dueAt:"2099-11-23T18:00:00Z"};
beforeEach(()=>{state.role="admin";state.rpc.mockReset().mockResolvedValue({data:{id:"new-id",number:"OS-2099-000001"},error:null});state.resolve.mockReset().mockResolvedValue({id:"internal-id"});});
describe("guided service persistence",()=>{
 it("creates a maintenance with automatic numbering, description and seller directly on the bench",async()=>{
  const result=await createGuidedOrder(input);expect(result.ok).toBe(true);
  expect(state.resolve).toHaveBeenCalledWith(expect.anything(),INTERNAL_MAINTENANCE);
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith("create_service_order",expect.objectContaining({p_external_order_id:null,p_laboratory_id:"internal-id",p_seller_id:"seller",p_status:"aguardando_montagem",p_service_description:"Manutenção — Troca de parafuso",p_client_name:"Manutenção — Troca de parafuso"}));
 });
 it("preserves a customer identification while keeping the repair description",async()=>{
  await createGuidedOrder({...input,clientName:"Maria — armação preta"});expect(state.rpc.mock.calls[0][1]).toMatchObject({p_client_name:"Maria — armação preta",p_service_description:"Manutenção — Troca de parafuso"});
 });
 it("keeps ordinary lens orders in the lens queue with the supplied OS and laboratory",async()=>{
  await createGuidedOrder({...input,serviceKind:"lentes",laboratoryId:"external",orderRef:"4567",clientName:"Maria"});
  expect(state.resolve).toHaveBeenCalledWith(expect.anything(),"external");
  expect(state.rpc.mock.calls[0][1]).toMatchObject({p_external_order_id:"4567",p_status:"aguardando_lentes",p_client_name:"Maria",p_service_description:"Lançamento rápido"});
 });
 it("denies read-only users before resolving catalogs or creating a service",async()=>{state.role="consulta";expect((await createGuidedOrder(input)).ok).toBe(false);expect(state.resolve).not.toHaveBeenCalled();expect(state.rpc).not.toHaveBeenCalled();});
 it("rejects incomplete repairs without writes",async()=>{expect((await createGuidedOrder({...input,serviceDescription:""})).ok).toBe(false);expect(state.resolve).not.toHaveBeenCalled();expect(state.rpc).not.toHaveBeenCalled();});
 it("does not claim success after a database error or unavailable internal catalog",async()=>{
  state.resolve.mockResolvedValueOnce({error:"Sem permissão"});expect((await createGuidedOrder(input)).ok).toBe(false);expect(state.rpc).not.toHaveBeenCalled();
  state.rpc.mockResolvedValueOnce({data:null,error:{message:"Falha ao criar"}});const result=await createGuidedOrder(input);expect(result.ok).toBe(false);expect(result.results[0].message).toBe("Falha ao criar");
 });
});

it("allows an existing OS for maintenance without replacing its reference",async()=>{
 await createGuidedOrder({...input,orderRef:"MAN-123"});expect(state.rpc.mock.calls[0][1]).toMatchObject({p_external_order_id:"MAN-123",p_status:"aguardando_montagem"});
});

it("creates express assembly atomically using 20/40/60 minutes, frame and internal assembly supplier",async()=>{
 const result=await createGuidedOrder({...input,serviceKind:"expressa",expressMinutes:40,frameState:"present",clientName:"Cliente expresso"});expect(result.ok).toBe(true);
 expect(state.resolve).toHaveBeenCalledWith(expect.anything(),"montagem_interna");
 expect(state.rpc).toHaveBeenCalledWith("create_service_order_configured",expect.objectContaining({p_frame_state:"present",p_express_minutes:40,p_order:expect.objectContaining({p_status:"aguardando_montagem",p_external_order_id:null,p_service_description:"Montagem expressa — 40 minutos"})}));
});
