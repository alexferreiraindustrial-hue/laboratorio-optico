/**
 * Lançamento rápido: a pessoa digita (ou o leitor bipa) uma linha e o sistema
 * entende o que é número de OS da ótica e o que é nome do cliente.
 *
 *   "4521 Maria Souza"   -> OS 4521 + nome
 *   "Maria Souza 4521"   -> OS 4521 + nome
 *   "4521"               -> só OS (esse número É a OS; o sistema não gera outro)
 *   "Maria Souza"        -> só nome (aí sim o sistema gera OS-ANO-SEQ)
 *   "OS-2026-000004"     -> referência a uma OS do sistema (usada na saída)
 */
export type QuickEntry = {
  raw: string;
  orderRef: string | null;
  clientName: string | null;
};

// Uma referência é um "código": um bloco sem espaços com pelo menos um dígito
// (4521, 4521-B, PED-001, TESTE-901). Nomes de cliente não têm dígitos.
const REF_PREFIX = /^(?:os|n[ºo°]?|#)[\s:.-]*(?=[0-9A-Za-z])/i;
const REF_BODY = /^[0-9A-Za-z][0-9A-Za-z./-]{0,24}$/;

function cleanRef(token: string) {
  let value = token.trim().replace(/[.,;:\s]+$/, "");
  const withoutPrefix = value.replace(REF_PREFIX, "");
  if (withoutPrefix !== value && /^\d/.test(withoutPrefix)) value = withoutPrefix;
  else if (/^#/.test(value)) value = value.slice(1);
  if (!REF_BODY.test(value) || !/\d/.test(value)) return null;
  return value;
}

function cleanName(text: string) {
  const name = text.replace(/\s+/g, " ").replace(/^[\s,;:-]+|[\s,;:-]+$/g, "").trim();
  return name.length >= 2 ? name : null;
}

export function parseQuickEntry(line: string): QuickEntry | null {
  const raw = line.replace(/\s+/g, " ").trim();
  if (!raw) return null;

  const systemNumber = raw.match(/^OS-\d{4}-\d{1,6}$/i);
  if (systemNumber) return { raw, orderRef: raw.toUpperCase(), clientName: null };

  const parts = raw.split(" ");
  if (parts.length === 1) {
    const ref = cleanRef(parts[0]);
    return ref ? { raw, orderRef: ref, clientName: null } : { raw, orderRef: null, clientName: cleanName(raw) };
  }

  // "OS 4521 Maria" ou "nº 4521 Maria": junta o prefixo ao número.
  if (/^(os|n[ºo°]?|#)$/i.test(parts[0]) && cleanRef(parts[1])) {
    return { raw, orderRef: cleanRef(parts[1]), clientName: cleanName(parts.slice(2).join(" ")) };
  }

  const firstRef = cleanRef(parts[0]);
  if (firstRef) return { raw, orderRef: firstRef, clientName: cleanName(parts.slice(1).join(" ")) };

  const lastRef = cleanRef(parts[parts.length - 1]);
  if (lastRef) return { raw, orderRef: lastRef, clientName: cleanName(parts.slice(0, -1).join(" ")) };

  return { raw, orderRef: null, clientName: cleanName(raw) };
}

/** Várias linhas coladas de uma vez (lista do WhatsApp, planilha etc.). */
export function parseQuickBatch(text: string): QuickEntry[] {
  return text
    .split(/\r?\n|;/)
    .map(parseQuickEntry)
    .filter((entry): entry is QuickEntry => Boolean(entry && (entry.orderRef || entry.clientName)));
}

/** Nome gravado na OS quando só o número foi informado. */
export function quickClientName(entry: QuickEntry) {
  return entry.clientName ?? `OS ${entry.orderRef}`;
}

/** Converte "4" ou "000004" em possível número do sistema do ano informado. */
export function systemNumberCandidates(ref: string, year: number) {
  const digits = ref.replace(/\D/g, "");
  if (!digits || digits.length > 6) return [];
  return [`OS-${year}-${digits.padStart(6, "0")}`, `OS-${year - 1}-${digits.padStart(6, "0")}`];
}
