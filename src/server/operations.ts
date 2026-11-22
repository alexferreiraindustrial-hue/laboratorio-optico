import type {SupabaseClient} from "@supabase/supabase-js";
import {OPERATIONS_COLUMNS,type OrderOperations} from "@/lib/domain/operations";
export async function loadOperations(supabase:SupabaseClient,ids:string[]){
 const map=new Map<string,OrderOperations>();
 for(let i=0;i<ids.length;i+=150){const {data,error}=await supabase.from("service_orders").select(OPERATIONS_COLUMNS).in("id",ids.slice(i,i+150));if(error)throw new Error("Não foi possível conferir armação e montagem expressa. Atualize a tela antes de movimentar serviços.");for(const item of data??[])map.set(item.id as string,item as OrderOperations);}
 return map;
}
