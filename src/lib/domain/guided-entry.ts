export type GuidedEntryInput = {
  serviceKind?: "lentes" | "manutencao";
  serviceDescription?: string;
  orderRef: string;
  clientName: string;
  sellerId: string;
  laboratoryId: string;
  storeId: string;
  dueAt: string;
};

export function validateGuidedEntry(input: GuidedEntryInput, now = new Date()) {
  if (input.serviceKind && input.serviceKind !== "lentes" && input.serviceKind !== "manutencao") return "Escolha o tipo de serviço.";
  const maintenance = input.serviceKind === "manutencao";
  if (!maintenance && !input.laboratoryId) return "Selecione o laboratório.";
  if (!input.sellerId) return "Selecione quem vendeu o serviço.";
  if (!maintenance && !input.orderRef.trim()) return "Informe o número da OS que está no papel.";
  if (input.orderRef.trim().length > 80) return "O número da OS deve ter até 80 caracteres.";
  if (input.clientName.trim().length > 200) return "O nome do cliente deve ter até 200 caracteres.";
  if (maintenance && (input.serviceDescription?.trim().length ?? 0) < 3) return "Descreva a manutenção que será feita.";
  if ((input.serviceDescription?.trim().length ?? 0) > 500) return "Descreva o serviço em até 500 caracteres.";
  if (!input.dueAt || !Number.isFinite(Date.parse(input.dueAt))) return "Informe a data e o horário prometidos ao cliente.";
  if (Date.parse(input.dueAt) <= now.getTime()) return "O prazo precisa ser uma data futura. Confira o dia e o horário.";
  return null;
}
