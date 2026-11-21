import { beforeEach,expect,it,vi } from "vitest";
const state=vi.hoisted(()=>({role:"admin",lab:null as null|{id:string},order:null as null|{id:string},update:vi.fn(),tables:vi.fn()}));
vi.mock("./session",()=>({requireProfile:async()=>({role:state.role,supabase:{from:(table:string)=>{state.tables(table);const chain={select:()=>chain,eq:()=>chain,update:(payload:unknown)=>{state.update(payload);return chain;},maybeSingle:async()=>({data:table==="laboratories"?state.lab:state.order,error:null})};return chain;}}}),actionError:(error:{message:string})=>error.message}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {updateOrderLaboratory} from "./flow-actions";
beforeEach(()=>{state.role="admin";state.lab=null;state.order=null;state.update.mockClear();state.tables.mockClear();});
it("does not allow consultation profile or unknown supplier to update an OS",async()=>{
 state.role="consulta";expect((await updateOrderLaboratory("order","lab")).ok).toBe(false);expect(state.tables).not.toHaveBeenCalled();
 state.role="admin";expect((await updateOrderLaboratory("order","lab")).ok).toBe(false);expect(state.update).not.toHaveBeenCalled();
});
it("changes only laboratory link and does not overwrite real order fields",async()=>{
 state.lab={id:"lab"};state.order={id:"order"};expect((await updateOrderLaboratory("order","lab")).ok).toBe(true);expect(state.update).toHaveBeenCalledWith({laboratory_id:"lab"});
});
it("reports a missing OS without claiming a successful update",async()=>{
 state.lab={id:"lab"};expect((await updateOrderLaboratory("missing","lab")).ok).toBe(false);
});
