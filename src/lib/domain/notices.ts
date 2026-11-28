import {visibleOrderNumber} from "./orders";
import {formatDateTime} from "../format";
import type {OrderOperations} from "./operations";
export const NOTICE_LABEL={ready:"Prontos para retirada",received:"Serviços recebidos",lenses:"Lentes recebidas",vta:"VTA · pedir armação",due:"Prazos próximos / atrasados",missing_ref:"Cobrar número do pedido"} as const;
export type NoticeKind=keyof typeof NOTICE_LABEL;
export type NoticeOrder=OrderOperations&{id:string;number:string;external_order_id:string|null;client_name:string;seller_id:string|null;seller_name:string|null;status:string;entered_at:string;due_at:string|null;completed_at:string|null;lens_supplier_ref:string|null;laboratory_name:string;mounted_at?:string|null;client_phone?:string|null};
export type NoticeLog={order_id:string;notice_kind:string;event_at:string;recipient:string;notified_at:string};
export function noticeEvent(order:NoticeOrder,kind:NoticeKind){return kind==="ready"?order.completed_at:kind==="lenses"||kind==="vta"?order.lens_arrived_at:kind==="due"?order.due_at:order.entered_at;}
export function noticeOrders(orders:NoticeOrder[],kind:NoticeKind,from:string,to:string,now:Date){
 const within=(date:string|null|undefined)=>Boolean(date&&new Date(date).getTime()>=Date.parse(from)&&new Date(date).getTime()<=Date.parse(to));
 return orders.filter(order=>{
  const open=!["pronto","entregue","cancelado"].includes(order.status);
  if(kind==="ready")return order.status==="pronto"&&within(order.completed_at);
  if(kind==="received")return order.status!=="cancelado"&&within(order.entered_at);
  if(kind==="lenses")return order.status!=="cancelado"&&within(order.lens_arrived_at);
  if(kind==="vta")return open&&order.frame_state==="vta"&&Boolean(order.lens_arrived_at);
  if(kind==="missing_ref")return order.status==="aguardando_lentes"&&!order.lens_arrived_at&&!order.lens_supplier_ref?.trim();
  return open&&Boolean(order.due_at&&Date.parse(order.due_at)<=now.getTime()+24*36e5);
 }).sort((a,b)=>(Date.parse(a.due_at||"")||Infinity)-(Date.parse(b.due_at||"")||Infinity)||a.id.localeCompare(b.id));
}
export function groupNoticeMessages(orders:NoticeOrder[],kind:NoticeKind){
 const groups=new Map<string,{id:string;name:string;orders:NoticeOrder[];message:string}>();
 for(const order of orders){const key=order.seller_id||"unassigned";if(!groups.has(key))groups.set(key,{id:key,name:order.seller_name||"Sem vendedora atribuída",orders:[],message:""});groups.get(key)!.orders.push(order);}
 const introductions:Record<NoticeKind,string>={ready:"Os serviços abaixo foram conferidos e estão liberados para retirada. Por favor, avise os clientes.",received:"Recebemos os serviços abaixo no laboratório.",lenses:"As lentes dos serviços abaixo chegaram ao laboratório. Confira os que estão marcados como VTA.",vta:"As lentes já chegaram, mas aguardamos a armação. Por favor, peça aos clientes que tragam a armação para montarmos os óculos.",due:"Estes serviços precisam de atenção ao prazo. Confira o andamento e avise o cliente caso seja necessário combinar uma nova entrega.",missing_ref:"Precisamos do número do pedido feito ao laboratório externo para os serviços abaixo. Mesmo sem previsão de chegada, envie o número do pedido, por favor."};
 return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")).map(group=>({...group,message:`Olá, ${group.name}!

${introductions[kind]}

${group.orders.map(order=>`• OS ${visibleOrderNumber(order)} — ${order.client_name}${order.due_at?` · prazo ${formatDateTime(order.due_at)}`:""}${kind==="missing_ref"?` · ${order.laboratory_name}`:""}${order.frame_state==="vta"?" · VTA: aguardando armação":""}`).join("\n")}

Lab Gold`}));
}
export function matchingNotice(logs:NoticeLog[],order:NoticeOrder,kind:NoticeKind,recipient:string){const event=noticeEvent(order,kind);return logs.find(log=>log.order_id===order.id&&log.notice_kind===kind&&log.recipient===recipient&&Date.parse(log.event_at)===Date.parse(event||""));}
