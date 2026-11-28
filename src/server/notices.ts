import {requireProfile} from "./session";
import {loadOperations} from "./operations";
import {clientPhones} from "./queries";
import type {NoticeOrder,NoticeLog} from "@/lib/domain/notices";
export async function loadNotices(from:string,to:string){
 const {supabase,role}=await requireProfile();
 const fields="id,number,external_order_id,client_name,seller_id,seller_name,status,entered_at,due_at,completed_at,lens_supplier_ref,laboratory_name";
 // Keep historical mounted services separate from currently open production; fetch explicit period windows.
 const [open,received,ready,arrivals,mounted,logs]=await Promise.all([
  supabase.from("orders_enriched").select(fields).not("status","in","(entregue,cancelado)").order("due_at",{ascending:true,nullsFirst:false}).limit(1000),
  supabase.from("orders_enriched").select(fields).gte("entered_at",from).lte("entered_at",to).limit(1000),
  supabase.from("orders_enriched").select(fields).gte("completed_at",from).lte("completed_at",to).limit(1000),
  supabase.from("service_orders").select("id").gte("lens_arrived_at",from).lte("lens_arrived_at",to).limit(1000),
  supabase.from("order_status_history").select("order_id,created_at").eq("to_status","em_conferencia").neq("from_status","em_conferencia").gte("created_at",from).lte("created_at",to).order("created_at",{ascending:false}).limit(1000),
  supabase.from("order_notice_logs").select("order_id,notice_kind,event_at,recipient,notified_at").order("notified_at",{ascending:false}).limit(3000),
 ]);
 const errors=[open,received,ready,arrivals,mounted,logs].filter(result=>result.error);if(errors.length)throw new Error("Não foi possível conferir a central de avisos. Atualize a página.");
 const combined=new Map<string,NoticeOrder>();for(const row of [...open.data??[],...received.data??[],...ready.data??[]])combined.set(row.id,row as NoticeOrder);
 const extraIds=[...new Set([...(arrivals.data??[]).map(row=>row.id),...(mounted.data??[]).map(row=>row.order_id)])].filter(id=>!combined.has(id));
 for(let i=0;i<extraIds.length;i+=150){const {data,error}=await supabase.from("orders_enriched").select(fields).in("id",extraIds.slice(i,i+150));if(error)throw new Error("Não foi possível conferir todos os serviços.");for(const row of data??[])combined.set(row.id,row as NoticeOrder);}
 const operations=await loadOperations(supabase,[...combined.keys()]);
 const mountedTimes=new Map<string,string>();for(const row of mounted.data??[])if(!mountedTimes.has(row.order_id))mountedTimes.set(row.order_id,row.created_at);
 const phones=await clientPhones([...combined.keys()]);
 const rows=[...combined.values()].map(row=>({...row,...operations.get(row.id),mounted_at:mountedTimes.get(row.id)||null,client_phone:phones.get(row.id)??null}));
 const sellerIds=[...new Set(rows.map(row=>row.seller_id).filter(Boolean))] as string[];
 const sellerPhones:Record<string,boolean>={};
 if(sellerIds.length){const {data}=await supabase.from("sellers").select("id,phone,whatsapp").in("id",sellerIds);for(const seller of data??[])sellerPhones[seller.id]=((seller.whatsapp||seller.phone||"") as string).replace(/\D/g,"").length>=10;}
 return {sellerPhones,rows,logs:(logs.data??[]) as NoticeLog[],role,truncated:[open,received,ready,arrivals,mounted].some(result=>(result.data?.length??0)>=1000)||(logs.data?.length??0)>=3000};
}
