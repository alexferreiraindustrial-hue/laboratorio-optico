import type { OrderStatus } from "./constants";

export type Urgency = "vermelho" | "amarelo" | "verde" | "cinza";

export function orderUrgency(input: {
  status: OrderStatus;
  priority: "normal" | "critica";
  dueAt: string | null;
  now: Date;
  alertHours: number;
}): Urgency {
  if (input.status === "cancelado" || input.status === "entregue") return "cinza";
  if (!input.dueAt) return "cinza";
  const due = new Date(input.dueAt).getTime();
  const now = input.now.getTime();
  if (input.priority === "critica" || due < now) return "vermelho";
  const windowMs = Math.max(0, input.alertHours) * 60 * 60 * 1000;
  if (due - now <= windowMs) return "amarelo";
  return "verde";
}

export function dueDeltaLabel(dueAt: string | null, now: Date, status: OrderStatus) {
  if (status === "cancelado" || status === "entregue" || !dueAt) return "Sem prazo aplicável";
  const diffMs = new Date(dueAt).getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  const parts = [
    days ? `${days}d` : null,
    hours ? `${hours}h` : null,
    !days && mins ? `${mins}min` : null,
  ].filter(Boolean);
  const text = parts.join(" ") || "menos de 1 min";
  return diffMs < 0 ? `Atraso de ${text}` : `Restam ${text}`;
}
