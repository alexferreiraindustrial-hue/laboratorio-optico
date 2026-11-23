export const FRAME_LABEL = {unknown:"Não informado",present:"Com armação",vta:"VTA · cliente vai trazer"} as const;
export type FrameState = keyof typeof FRAME_LABEL;
export const EXPRESS_MINUTES = [20,40,60] as const;
export type ExpressMinutes = typeof EXPRESS_MINUTES[number];
export type OrderOperations = {
 frame_state?:FrameState|null; express_minutes?:number|null; express_started_at?:string|null; express_finished_at?:string|null;
 medical_review_required?:boolean|null; medical_review_approved_at?:string|null; medical_review_note?:string|null; assistance_kind?:string|null; assistance_origin_order_id?:string|null;
 lens_arrived_at?:string|null; updated_at?:string;
};
export const OPERATIONS_COLUMNS="id,frame_state,express_minutes,express_started_at,express_finished_at,lens_arrived_at,updated_at,medical_review_required,medical_review_approved_at,medical_review_note,assistance_kind,assistance_origin_order_id";
export function operationsError(frame:unknown,minutes:unknown){
 if(frame!=null && !Object.hasOwn(FRAME_LABEL,String(frame)))return "Informe a situação da armação.";
 if(minutes!=null && !EXPRESS_MINUTES.includes(minutes as ExpressMinutes))return "Escolha 20, 40 ou 60 minutos.";
 return null;
}
export function waitingForFrame(order:OrderOperations){return order.frame_state==="vta" && Boolean(order.lens_arrived_at);}
export function expressClock(order:OrderOperations,now:Date){
 if(!order.express_minutes)return null;
 if(!order.express_started_at)return {label:`Expressa ${order.express_minutes} min · aguardando início`,tone:"waiting" as const,remaining:null};
 const end=new Date(order.express_finished_at||now).getTime();
 const remaining=order.express_minutes*60000-(end-new Date(order.express_started_at).getTime());
 const seconds=Math.ceil(Math.abs(remaining)/1000);const time=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
 return {remaining,tone:remaining<0?"late" as const:remaining<=5*60000?"soon" as const:"running" as const,label:order.express_finished_at?`Montagem ${remaining<0?"concluída com atraso":"concluída no tempo"}`:remaining<0?`Expressa · ${time} em atraso`:`Expressa · ${time} restantes`};
}
