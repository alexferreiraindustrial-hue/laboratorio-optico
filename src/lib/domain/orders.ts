import type { OrderStatus } from "./constants";

export type OrderDraft = {
  clientName: string;
  laboratoryId: string;
  sellerId: string | null;
  enteredAt: string;
  dueAt: string | null;
  serviceDescription: string;
  externalOrderId: string | null;
  status: OrderStatus;
  priority: "normal" | "critica";
};

export function validateOrderDraft(draft: OrderDraft): string[] {
  const errors: string[] = [];
  if (!draft.clientName.trim()) errors.push("Informe o cliente ou a loja.");
  if (!draft.laboratoryId) errors.push("Selecione o laboratório.");
  if (!draft.serviceDescription.trim()) errors.push("Descreva o serviço.");
  if (!draft.enteredAt || Number.isNaN(new Date(draft.enteredAt).getTime())) {
    errors.push("Informe a data e a hora de entrada.");
  }
  if (draft.dueAt) {
    if (Number.isNaN(new Date(draft.dueAt).getTime())) {
      errors.push("A previsão de conclusão é inválida.");
    } else if (new Date(draft.dueAt).getTime() < new Date(draft.enteredAt).getTime()) {
      errors.push("A previsão não pode ser anterior à entrada.");
    }
  }
  if (draft.status !== "aguardando_lentes" && draft.status !== "aguardando_montagem") {
    errors.push("Uma OS nova começa aguardando lentes ou aguardando montagem.");
  }
  return errors;
}

export function duplicateOrderMessage(
  existing: { number: string; externalOrderId: string | null }[],
  candidate: { number?: string | null; externalOrderId?: string | null },
): string | null {
  const number = candidate.number?.trim();
  const external = candidate.externalOrderId?.trim();
  if (number && existing.some((item) => item.number === number)) {
    return `Já existe uma OS com o número ${number}.`;
  }
  if (external && existing.some((item) => item.externalOrderId === external)) {
    return `O pedido externo ${external} já está vinculado a outra OS.`;
  }
  return null;
}
