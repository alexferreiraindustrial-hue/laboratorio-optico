"use server";
import {revalidatePath} from "next/cache";
import {requireProfile,actionError} from "./session";
import {can} from "@/lib/domain/permissions";
function refresh(){for(const path of ["/assistencia","/montagem","/lentes","/laboratorio","/inicio","/dashboard","/entrega","/avisos"])revalidatePath(path);}
export async function saveMedicalReview(id:string,required:boolean,version:string){
 const {supabase,role}=await requireProfile();if(!can(role,"orders.write"))return {ok:false,message:"Sem permissão."};
 const {error}=await supabase.rpc("configure_medical_review",{p_order_id:id,p_required:required,p_expected_updated_at:version});
 if(error)return {ok:false,message:actionError(error,"Não foi possível salvar a indicação médica.")??"Erro ao salvar."};refresh();revalidatePath(`/laboratorio/${id}`);return {ok:true,message:"Indicação médica atualizada."};
}
export async function approveMedicalReview(id:string,note:string,version:string){
 const {supabase,role}=await requireProfile();if(!can(role,"orders.write"))return {ok:false,message:"Sem permissão."};
 const {error}=await supabase.rpc("approve_medical_review",{p_order_id:id,p_note:note,p_expected_updated_at:version});
 if(error)return {ok:false,message:actionError(error,"Não foi possível registrar o retorno médico.")??"Erro ao salvar."};refresh();revalidatePath(`/laboratorio/${id}`);return {ok:true,message:"Retorno médico registrado. Serviço liberado para retirada."};
}
export async function createAssistance(input:{original:string;kind:string;description:string;due:string;needsLenses:boolean;medical:boolean}){
 const {supabase,role}=await requireProfile();if(!can(role,"orders.write"))return {ok:false,message:"Sem permissão."};
 const {data,error}=await supabase.rpc("create_assistance_order",{p_original_number:input.original,p_kind:input.kind,p_description:input.description,p_due_at:input.due,p_needs_lenses:input.needsLenses,p_medical_required:input.medical});
 if(error)return {ok:false,message:actionError(error,"Não foi possível criar a assistência.")??"Erro ao salvar."};refresh();return {ok:true,message:`Assistência ${data.number} registrada. A OS original foi preservada.`,id:data.id as string};
}
