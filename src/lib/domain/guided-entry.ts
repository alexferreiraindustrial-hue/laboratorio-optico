export type GuidedEntryInput = {
  orderRef: string;
  clientName: string;
  sellerId: string;
  laboratoryId: string;
  storeId: string;
  dueAt: string;
};

export function validateGuidedEntry(input: GuidedEntryInput, now = new Date()) {
  if (!input.laboratoryId) return "Selecione o laboratório.";
  if (!input.sellerId) return "Selecione quem vendeu o serviço.";
  if (!input.orderRef.trim()) return "Informe o número da OS que está no papel.";
  if (input.orderRef.trim().length > 80) return "O número da OS deve ter até 80 caracteres.";
  if (!input.dueAt || !Number.isFinite(Date.parse(input.dueAt))) return "Informe a data e o horário prometidos ao cliente.";
  if (Date.parse(input.dueAt) <= now.getTime()) return "O prazo precisa ser uma data futura. Confira o dia e o horário.";
  return null;
}
