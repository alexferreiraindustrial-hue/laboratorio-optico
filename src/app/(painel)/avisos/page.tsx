import {NoticeCenter} from "@/components/notice-center";
import {PageHeading} from "@/components/shell";
import {loadNotices} from "@/server/notices";
import {listSellerContacts} from "@/server/contact-actions";
import {SellerContacts} from "@/components/seller-contacts";
import {dateTimeLocalToIso,dayRange} from "@/lib/domain/calendar";
export default async function AvisosPage({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){
 const raw=await searchParams;const now=new Date();const day=dayRange(now);let from=day.start.toISOString();let to=now.toISOString();
 try{if(raw.from)from=dateTimeLocalToIso(raw.from);if(raw.to)to=dateTimeLocalToIso(raw.to);}catch{return <p role="alert">Confira o período informado.</p>;}
 if(Date.parse(from)>Date.parse(to))return <p role="alert">O início precisa ser anterior ao fim do período.</p>;
 const [data,sellers]=await Promise.all([loadNotices(from,to),listSellerContacts()]);
 return <div className="grid gap-3"><PageHeading title="Avisos e serviços montados" description="Escolha os serviços, gere a mensagem de cada vendedora e envie pelo WhatsApp da Goldfinger. Prontos para retirada no período de hoje mostra o que foi para a gaveta hoje."/>{sellers.length>0&&<SellerContacts sellers={sellers}/>}<NoticeCenter key={`${from}-${to}`} {...data} from={from} to={to} nowIso={now.toISOString()}/></div>;
}
