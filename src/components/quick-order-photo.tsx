"use client";
import { useRef,useState } from "react";
import { Camera,ImagePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeStoragePath,validateAttachment } from "@/lib/domain/files";
import type { StepKey } from "@/lib/domain/constants";
export function QuickOrderPhoto({orderId,stepKey}:{orderId:string;stepKey?:StepKey}) {
 const router=useRouter();const busy=useRef(false);const[pending,setPending]=useState(false);const[message,setMessage]=useState<string|null>(null);const[error,setError]=useState<string|null>(null);
 async function upload(file:File|undefined,input:HTMLInputElement){
  if(!file||busy.current)return;
  const invalid=validateAttachment(file);if(invalid||!file.type.startsWith("image/")){setError(invalid||"Escolha uma foto.");input.value="";return;}
  busy.current=true;setPending(true);setError(null);setMessage(null);
  try{
   const supabase=createClient();const {data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)throw new Error("Seu acesso precisa ser renovado. Entre novamente antes de enviar.");
   let entityType:"order"|"step"="order";let entityId=orderId;
   if(stepKey){const {data,error:stepError}=await supabase.from("assembly_steps").select("id").eq("order_id",orderId).eq("step_key",stepKey).maybeSingle();if(stepError)throw new Error("Não foi possível localizar a etapa. Tente novamente.");if(data){entityType="step";entityId=data.id;}}
   const id=crypto.randomUUID();const path=safeStoragePath(entityType,entityId,file.type,id);
   const uploaded=await supabase.storage.from("lab-files").upload(path,file,{contentType:file.type});if(uploaded.error)throw new Error(uploaded.error.message);
   const inserted=await supabase.from("attachments").insert({id,entity_type:entityType,entity_id:entityId,storage_path:path,file_name:file.name.slice(0,120),mime_type:file.type,size_bytes:file.size,uploaded_by:auth.user.id});
   if(inserted.error){await supabase.storage.from("lab-files").remove([path]);throw new Error("Não foi possível vincular a foto. Tente novamente.");}
   setMessage(stepKey?"Foto salva na etapa desta OS.":"Foto salva nesta OS.");router.refresh();
  }catch(error){setError(error instanceof Error?error.message:"Falha no envio. Confira a conexão e tente novamente.");}
  finally{busy.current=false;setPending(false);input.value="";}
 }
 return <div className="grid gap-2 rounded-lg border border-[var(--line)] p-2"><p className="text-xs font-semibold">{pending?"Enviando foto…":"Foto rápida do serviço"}</p><div className="flex flex-wrap gap-2">{[{camera:true,label:"Tirar foto",Icon:Camera},{camera:false,label:"Galeria",Icon:ImagePlus}].map(({camera,label,Icon})=><label key={label} className="relative flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--link)] focus-within:ring-2 focus-within:ring-[var(--focus)]"><Icon size={17}/>{label}<input type="file" accept="image/*" capture={camera?"environment":undefined} disabled={pending} aria-label={`${label} para esta OS`} className="sr-only" onChange={event=>void upload(event.target.files?.[0],event.target)}/></label>)}</div>{error&&<p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}{message&&<p role="status" className="text-sm text-[var(--ok)]">{message}</p>}<Link className="min-h-11 py-2 text-xs font-semibold text-[var(--link)] underline" href={`/montagem/${orderId}#fotos`}>Ver fotos e histórico da OS</Link></div>;
}
