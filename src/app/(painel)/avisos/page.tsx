import {NoticeCenter} from "@/components/notice-center";
import {PageHeading} from "@/components/shell";
import {loadNotices} from "@/server/notices";
import {dateTimeLocalToIso,dayRange} from "@/lib/domain/calendar";
export default async function AvisosPage({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){
 const raw=await searchParams;const now=new Date();const day=dayRange(now);let from=day.start.toISOString();let to=now.toISOString();
 try{if(raw.from)from=dateTimeLocalToIso(raw.from);if(raw.to)to=dateTimeLocalToIso(raw.to);}catch{return <p role="alert">Confira o período informado.</p>;}
 if(Date.parse(from)>Date.parse(to))return <p role="alert">O início precisa ser anterior ao fim do período.</p>;
 const data=await loadNotices(from,to);
 return <div className="grid gap-3"><PageHeading title="Avisos e serviços montados" description="Confira os serviços e gere mensagens separadas por vendedora. Envio manual, no contato individual."/><NoticeCenter key={`${from}-${to}`} {...data} from={from} to={to} nowIso={now.toISOString()}/></div>;
}
