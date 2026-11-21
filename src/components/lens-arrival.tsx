"use client";
import { toast } from "sonner";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { quickMoveOrders } from "@/server/quick-actions";
import { OrderLaboratory } from "./order-laboratory";
import { Button,Feedback } from "./ui";
export function LensArrival({orderId,canReceive=true,showLaboratory=true,compact=false,dense=false}:{orderId:string;canReceive?:boolean;showLaboratory?:boolean;compact?:boolean;dense?:boolean}) {
 const router=useRouter();const[pending,start]=useTransition();const[error,setError]=useState<string|null>(null);const[done,setDone]=useState(false);
 return <div className={dense?"grid gap-1":"mt-2 grid gap-2"}>{showLaboratory && <OrderLaboratory orderId={orderId}/>}{canReceive && (done?<Link href="/montagem" className="min-h-11 font-semibold text-[var(--link)]">Enviada à bancada · abrir montagem →</Link>:<Button size={dense?"sm":"default"} type="button" title="Registrar chegada e enviar à bancada de montagem" className={dense?"min-h-11 whitespace-nowrap px-2 text-xs":compact?"w-full whitespace-normal px-2 text-xs":""} disabled={pending} onClick={()=>{if(pending)return;start(async()=>{try{const result=await quickMoveOrders([orderId],"aguardando_montagem","Lentes recebidas e encaminhadas à bancada");if(!result.ok){setError(result.message);return;}setError(null);setDone(true);toast.success("Lentes recebidas. OS enviada à bancada de montagem.");router.refresh();}catch{setError("Não foi possível registrar a chegada. Tente novamente.");}});}}>{pending?"Enviando à bancada…":dense?"Lente chegou":compact?"Lente chegou → montagem":"Lente chegou → enviar à bancada"}</Button>)}<Feedback error={error}/></div>;
}
