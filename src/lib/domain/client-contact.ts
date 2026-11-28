import { STORE_NAME } from "./client-followup";

/** Só os números do telefone; vazio quando não há nada. */
export function phoneDigits(raw: string | null | undefined) {
  return (raw ?? "").replace(/\D/g, "");
}

/** Telefone aceito no cadastro: DDD + número (10 a 15 dígitos). */
export function validPhone(raw: string | null | undefined) {
  const digits = phoneDigits(raw);
  return digits.length >= 10 && digits.length <= 15;
}

/** Formato internacional do WhatsApp (+55 quando vier só DDD + número). */
export function whatsappE164(raw: string | null | undefined) {
  const digits = phoneDigits(raw);
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits.length <= 11 ? `55${digits}` : digits}`;
}

/** Mostra o telefone de um jeito fácil de conferir: (12) 99697-6233. */
export function formatPhone(raw: string | null | undefined) {
  const digits = phoneDigits(raw);
  const local = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digits;
}

export function firstName(name: string | null | undefined) {
  const clean = (name ?? "").trim();
  return clean.split(/\s+/)[0] || clean || "cliente";
}

/** Aviso ao cliente de que os óculos estão prontos na loja. */
export function readyMessage(client: string) {
  return `Olá, ${firstName(client)}! Aqui é da ${STORE_NAME} 😊\nSeus óculos já estão prontos e esperando por você na loja. Quando puder, é só passar para retirar!`;
}

/** Pedir para o cliente passar na loja ou falar com a equipe. */
export function callStoreMessage(client: string) {
  return `Olá, ${firstName(client)}! Aqui é da ${STORE_NAME} 😊\nPrecisamos falar com você sobre seus óculos. Quando puder, passe na loja ou responda esta mensagem, por favor.`;
}

/** Modelos rápidos para escrever ao cliente; o texto sempre pode ser editado antes de enviar. */
export function clientTemplates(client: string, status: string) {
  const list = [
    { key: "loja", label: "Pedir para passar na loja", text: callStoreMessage(client) },
    { key: "livre", label: "Mensagem livre", text: `Olá, ${firstName(client)}! Aqui é da ${STORE_NAME}. ` },
  ];
  if (status === "pronto") list.unshift({ key: "pronto", label: "Óculos pronto", text: readyMessage(client) });
  return list;
}

/** Link do WhatsApp (abre no aparelho) com a mensagem pronta. */
export function waMeLink(phone: string | null | undefined, text: string) {
  const full = whatsappE164(phone);
  return full ? `https://wa.me/${full.slice(1)}?text=${encodeURIComponent(text)}` : null;
}
