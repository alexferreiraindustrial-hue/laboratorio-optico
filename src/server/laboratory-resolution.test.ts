import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveLaboratory } from "./laboratory-resolution";
import { INTERNAL_MAINTENANCE, PENDING_LABORATORY } from "@/lib/domain/laboratories";
function client(reads: unknown[], created: unknown = {data:null,error:{code:"42501"}}) {
 const insert=vi.fn(); const tables=vi.fn();
 const chain={select:()=>chain,eq:()=>chain,maybeSingle:vi.fn(async()=>reads.shift()),insert:(value:unknown)=>{insert(value);return chain;},single:async()=>created};
 return {supabase:{from:(table:string)=>{tables(table);return chain;}} as unknown as SupabaseClient,insert,tables};
}
describe("pending supplier resolution",()=>{
 it("passes existing supplier through without writing any catalog or OS",async()=>{const c=client([]);expect(await resolveLaboratory(c.supabase,"existing-id")).toEqual({id:"existing-id"});expect(c.tables).not.toHaveBeenCalled();});
 it("reuses an active pending supplier",async()=>{const c=client([{data:{id:"pending",active:true},error:null}]);expect(await resolveLaboratory(c.supabase,PENDING_LABORATORY)).toEqual({id:"pending"});expect(c.insert).not.toHaveBeenCalled();});
 it("creates only the catalog when explicitly selected on save",async()=>{const c=client([{data:null,error:null}],{data:{id:"created"},error:null});expect(await resolveLaboratory(c.supabase,PENDING_LABORATORY)).toEqual({id:"created"});expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({code:"LAB_A_DEFINIR",active:true}));expect(c.tables.mock.calls.every(([table])=>table==="laboratories")).toBe(true);});
 it("handles concurrent creation without duplicate catalogs",async()=>{const c=client([{data:null,error:null},{data:{id:"winner",active:true},error:null}],{data:null,error:{code:"23505"}});expect(await resolveLaboratory(c.supabase,PENDING_LABORATORY)).toEqual({id:"winner"});});
 it("does not reactivate an inactive supplier",async()=>{const c=client([{data:{id:"inactive",active:false},error:null}]);expect((await resolveLaboratory(c.supabase,PENDING_LABORATORY)).error).toContain("inativo");expect(c.insert).not.toHaveBeenCalled();});
 it("reports permission failure without returning a fake supplier",async()=>{const c=client([{data:null,error:null}]);const result=await resolveLaboratory(c.supabase,PENDING_LABORATORY);expect(result.error).toContain("administrador");expect(result.id).toBeUndefined();});
});

it("resolves maintenance into its own internal catalog, without assigning an external supplier",async()=>{
 const c=client([{data:null,error:null}],{data:{id:"internal"},error:null});
 expect(await resolveLaboratory(c.supabase,INTERNAL_MAINTENANCE)).toEqual({id:"internal"});
 expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({code:"LAB_MANUTENCAO_INTERNA",name:"Manutenção interna"}));
});
