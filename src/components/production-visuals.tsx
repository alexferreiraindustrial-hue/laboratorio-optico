import type { CSSProperties } from "react";
import type { OrderStatus } from "@/lib/domain/constants";

export const STAGE_COLOR: Record<OrderStatus,string> = {
 aguardando_lentes:"var(--stage-lentes)", aguardando_montagem:"var(--stage-lentes)",
 em_montagem:"var(--stage-montagem)", em_conferencia:"var(--stage-conferencia)",
 em_correcao:"var(--stage-correcao)", pronto:"var(--stage-pronto)",
 entregue:"var(--stage-pronto)", cancelado:"var(--muted)",
};
export function stageStyle(status:OrderStatus): CSSProperties {return {"--lane":STAGE_COLOR[status]} as CSSProperties;}

export function StepTrack({done}:{done:number}) {
 const completed=Math.max(0,Math.min(5,done));
 return <div className="lg-step-track" role="img" aria-label={`${completed} de 5 etapas concluídas`}>{Array.from({length:5},(_,i)=><span key={i} data-done={i<completed}/>)}</div>;
}
