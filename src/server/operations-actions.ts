"use server";
import {revalidatePath} from "next/cache";
import {requireProfile,actionError} from "./session";
import {can} from "@/lib/domain/permissions";
import {operationsError,type FrameState} from "@/lib/domain/operations";
import type {ActionResult} from "@/lib/types";
function refresh(id:string){for(const path of ["/lentes","/montagem","/laboratorio","/inicio","/avisos",`/laboratorio/${id}`,`/montagem/${id}`])revalidatePath(path);}
export async function configureOrderOperations(id:string,frame:FrameState,minutes:number|null,expectedUpdatedAt?:string):Promise<ActionResult>{
 const {supabase,role}=await requireProfile();if(!can(role,"orders.write"))return {ok:false,message:"Sem permissão."};
 const invalid=operationsError(frame,minutes);if(invalid)return {ok:false,message:invalid};
 const {error}=await supabase.rpc("configure_order_operations",{p_order_id:id,p_frame_state:frame,p_express_minutes:minutes,p_expected_updated_at:expectedUpdatedAt||null});
 if(error)return {ok:false,message:actionError(error,"Não foi possível atualizar a armação.")??""};refresh(id);return {ok:true,message:"Armação e modalidade atualizadas."};
}
export async function receiveOrderFrame(id:string,minutes:number|null):Promise<ActionResult>{
 const {supabase,role}=await requireProfile();if(!can(role,"orders.status"))return {ok:false,message:"Sem permissão."};
 const invalid=operationsError("present",minutes);if(invalid)return {ok:false,message:invalid};
 const {data,error}=await supabase.rpc("receive_order_frame",{p_order_id:id,p_express_minutes:minutes});
 if(error)return {ok:false,message:actionError(error,"Não foi possível registrar a armação.")??""};refresh(id);return {ok:true,message:data?.status==="aguardando_montagem"?"Armação recebida. Serviço disponível na bancada.":"Armação recebida. Continua aguardando a lente."};
}
export async function markOrderNotice(id:string,kind:string,eventAt:string,recipient:"seller"|"client"):Promise<ActionResult>{
 const {supabase,role}=await requireProfile();if(!can(role,"orders.write"))return {ok:false,message:"Sem permissão."};
 const {error}=await supabase.rpc("mark_order_notice",{p_order_id:id,p_kind:kind,p_event_at:eventAt,p_recipient:recipient});
 if(error)return {ok:false,message:actionError(error,"Não foi possível registrar o aviso.")??""};refresh(id);return {ok:true,message:"Aviso confirmado manualmente."};
}
