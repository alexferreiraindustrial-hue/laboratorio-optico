import type { MovementType } from "./constants";

export type StockTone = "vermelho" | "amarelo" | "verde";

export function stockTone(
  quantity: number,
  minQty: number,
  idealQty: number | null,
): StockTone {
  if (quantity <= 0 || quantity < minQty) return "vermelho";
  if (idealQty != null && idealQty > minQty && quantity < idealQty) return "amarelo";
  if ((idealQty == null || idealQty <= minQty) && minQty > 0 && quantity === minQty) {
    return "amarelo";
  }
  return "verde";
}

export function applyMovement(input: {
  current: number;
  type: MovementType;
  quantity: number;
  allowNegative?: boolean;
}): { next: number; delta: number } {
  const { current, type, quantity, allowNegative } = input;
  if (!Number.isInteger(quantity)) {
    throw new Error("A quantidade precisa ser um número inteiro.");
  }
  if (type !== "correcao" && quantity <= 0) {
    throw new Error("Informe uma quantidade maior que zero.");
  }
  if (type === "correcao" && quantity === 0) {
    throw new Error("A correção não pode ser zero.");
  }
  if (type === "ajuste" && quantity < 0) {
    throw new Error("O inventário não pode ser negativo.");
  }

  let delta = 0;
  if (type === "entrada" || type === "devolucao") delta = quantity;
  if (type === "saida" || type === "consumo") delta = -quantity;
  if (type === "ajuste") delta = quantity - current;
  if (type === "correcao") delta = quantity;

  const next = current + delta;
  if (next < 0 && !allowNegative) {
    throw new Error("A saída é maior que o saldo disponível.");
  }
  return { next, delta };
}

export function consumptionKey(orderId: string, stockId: string) {
  return `consumo:${orderId}:${stockId}`;
}

export function assertConsumptionAvailable(
  existingKeys: string[],
  orderId: string,
  stockId: string,
) {
  const key = consumptionKey(orderId, stockId);
  if (existingKeys.includes(key)) {
    throw new Error("Esta OS já consumiu este item de estoque.");
  }
  return key;
}
