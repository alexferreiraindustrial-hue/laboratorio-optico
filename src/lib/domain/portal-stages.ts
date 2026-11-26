// Etapas do laboratório explicadas para a vendedora (portal e app).
// Cada etapa diz onde o serviço está e o que a vendedora pode fazer.

export type SellerStageKey = "lentes" | "fila" | "bancada" | "conferencia" | "pronta" | "entregue" | "cancelada";

export const SELLER_STAGES: { key: SellerStageKey; label: string; now: string; tip: string }[] = [
  { key: "lentes", label: "Esperando a lente", now: "A lente foi pedida ao fornecedor e ainda não chegou ao laboratório.", tip: "Se o cliente tiver pressa, mande um recado pela OS." },
  { key: "fila", label: "Na fila da montagem", now: "A lente chegou. O serviço está na fila da bancada para ser montado.", tip: "Se a armação é do cliente (VTA), confirme que ela já foi entregue ao laboratório." },
  { key: "bancada", label: "Sendo montado", now: "O óculos está na bancada: corte, montagem e ajuste.", tip: "Agora é só aguardar; o prazo aparece no cartão." },
  { key: "conferencia", label: "Conferência / médico", now: "Montado. Está sendo conferido ou aguardando o retorno do médico.", tip: "Assim que for liberado, aparece em Prontas para retirar." },
  { key: "pronta", label: "Pronta para retirar", now: "O óculos está pronto na gaveta do laboratório.", tip: "Avise o cliente para buscar." },
  { key: "entregue", label: "Entregue", now: "O óculos já foi entregue.", tip: "" },
  { key: "cancelada", label: "Cancelada", now: "Esta OS foi cancelada.", tip: "" },
];

/** Em produção, na ordem do laboratório. */
export const SELLER_PRODUCTION: SellerStageKey[] = ["lentes", "fila", "bancada", "conferencia"];

export function sellerStage(status: string): SellerStageKey {
  switch (status) {
    case "aguardando_lentes": return "lentes";
    case "aguardando_montagem": return "fila";
    case "em_montagem": case "em_correcao": return "bancada";
    case "em_conferencia": return "conferencia";
    case "pronto": return "pronta";
    case "entregue": return "entregue";
    default: return "cancelada";
  }
}

export function sellerStageInfo(status: string) {
  const key = sellerStage(status);
  return SELLER_STAGES.find((stage) => stage.key === key)!;
}
