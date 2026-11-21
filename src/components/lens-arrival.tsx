"use client";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { quickMoveOrders } from "@/server/quick-actions";
import { OrderLaboratory } from "./order-laboratory";
import { Button,Feedback } from "./ui";
export function LensArrival({orderId,canReceive=true}:{orderId:string;canReceive?:boolean}) {
 const router=useRouter();const[pending,start]=useTransition();const[error,setError]=useState<string|null>(null);const[done,setDone]=useState(false);
 return <div className="mt-2 grid gap-2"><OrderLaboratory orderId={orderId}/>{canReceive && (done?<Link href="/montagem" className="min-h-11 font-semibold text-[var(--link)]">Enviada à bancada · abrir montagem →</Link>:<Button type="button" disabled={pending} onClick={()=>{if(pending)return;start(async()=>{try{const result=await quickMoveOrders([orderId],"aguardando_montagem","Lentes recebidas e encaminhadas à bancada");if(!result.ok){setError(result.message);return;}setError(null);setDone(true);router.refresh();}catch{setError("Não foi possível registrar a chegada. Tente novamente.");}});}}>{pending?"Enviando à bancada…":"Lente chegou → enviar à bancada"}</Button>)}<Feedback error={error}/></div>;
}
