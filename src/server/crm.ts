import "server-only";
import { whatsappE164, phoneDigits } from "@/lib/domain/client-contact";

// Envio de WhatsApp pelo CRM Industrial (Chatwoot + WAHA), no número da Goldfinger Laboratório.
// Configuração na Vercel: CRM_API_TOKEN (obrigatório). Opcionais: CRM_URL, CRM_ACCOUNT_ID, CRM_INBOX_ID.
// Sem conta/caixa informadas, o sistema acha sozinho a conta "Goldfinger" e a caixa de WhatsApp dela.

type Config = { url: string; token: string; accountId: number; inboxId: number };
export type CrmResult = { ok: true; message: string } | { ok: false; message: string };

let cached: Config | null = null;

export function crmConfigured() {
  return Boolean(process.env.CRM_API_TOKEN?.trim());
}

class CrmError extends Error {}

async function call<T>(url: string, token: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${url}${path}`, {
      method: init.method ?? "GET",
      headers: { api_access_token: token, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new CrmError("O CRM não respondeu. Confira se ele está no ar e tente de novo.");
  }
  if (response.status === 401) throw new CrmError("A chave do CRM não foi aceita. Confira o CRM_API_TOKEN na Vercel.");
  if (!response.ok) throw new CrmError(`O CRM recusou o envio (erro ${response.status}).`);
  return (await response.json()) as T;
}

async function config(): Promise<Config> {
  if (cached) return cached;
  const token = process.env.CRM_API_TOKEN?.trim();
  if (!token) throw new CrmError("O envio pelo CRM ainda não foi ligado: falta o CRM_API_TOKEN na Vercel.");
  const url = (process.env.CRM_URL?.trim() || "https://crm.oticahub.com").replace(/\/+$/, "");
  let accountId = Number(process.env.CRM_ACCOUNT_ID) || 0;
  if (!accountId) {
    const profile = await call<{ accounts?: { id: number; name: string }[] }>(url, token, "/api/v1/profile");
    const accounts = profile.accounts ?? [];
    const match = accounts.find((item) => /gold\s*finger/i.test(item.name)) ?? (accounts.length === 1 ? accounts[0] : undefined);
    if (!match) throw new CrmError("Não achei a conta Goldfinger no CRM. Informe o CRM_ACCOUNT_ID na Vercel.");
    accountId = match.id;
  }
  let inboxId = Number(process.env.CRM_INBOX_ID) || 0;
  if (!inboxId) {
    const inboxes = await call<{ payload?: { id: number; name: string; channel_type: string }[] }>(url, token, `/api/v1/accounts/${accountId}/inboxes`);
    const list = inboxes.payload ?? [];
    const match = list.find((item) => /whats/i.test(item.name)) ?? list.find((item) => item.channel_type === "Channel::Api");
    if (!match) throw new CrmError("Não achei a caixa de WhatsApp da Goldfinger no CRM. Informe o CRM_INBOX_ID na Vercel.");
    inboxId = match.id;
  }
  cached = { url, token, accountId, inboxId };
  return cached;
}

type Contact = { id: number; phone_number?: string | null; contact_inboxes?: { source_id: string; inbox?: { id: number } }[] };

async function contactFor(cfg: Config, phone: string, name: string) {
  const base = `/api/v1/accounts/${cfg.accountId}`;
  const digits = phoneDigits(phone);
  const tail = digits.slice(-8);
  const search = await call<{ payload?: Contact[] }>(cfg.url, cfg.token, `${base}/contacts/search?q=${encodeURIComponent(tail)}&include_contact_inboxes=true`);
  const found = (search.payload ?? []).find((item) => phoneDigits(item.phone_number).endsWith(tail));
  if (found) {
    const inbox = found.contact_inboxes?.find((item) => item.inbox?.id === cfg.inboxId);
    if (inbox) return { contactId: found.id, sourceId: inbox.source_id };
    const created = await call<{ source_id: string }>(cfg.url, cfg.token, `${base}/contacts/${found.id}/contact_inboxes`, { method: "POST", body: { inbox_id: cfg.inboxId } });
    return { contactId: found.id, sourceId: created.source_id };
  }
  const created = await call<{ payload: { contact: Contact; contact_inbox: { source_id: string } } }>(cfg.url, cfg.token, `${base}/contacts`, {
    method: "POST",
    body: { name: name.trim() || phone, phone_number: phone, inbox_id: cfg.inboxId },
  });
  return { contactId: created.payload.contact.id, sourceId: created.payload.contact_inbox.source_id };
}

async function conversationFor(cfg: Config, contactId: number, sourceId: string) {
  const base = `/api/v1/accounts/${cfg.accountId}`;
  const list = await call<{ payload?: { id: number; inbox_id: number; status: string }[] }>(cfg.url, cfg.token, `${base}/contacts/${contactId}/conversations`);
  const open = (list.payload ?? []).find((item) => item.inbox_id === cfg.inboxId && item.status !== "resolved");
  if (open) return open.id;
  const created = await call<{ id: number }>(cfg.url, cfg.token, `${base}/conversations`, {
    method: "POST",
    body: { source_id: sourceId, inbox_id: cfg.inboxId, contact_id: contactId, status: "open" },
  });
  return created.id;
}

/** Envia uma mensagem de WhatsApp pelo CRM. A conversa fica registrada no CRM. */
export async function sendCrmWhatsApp(input: { phone: string | null | undefined; name: string; text: string }): Promise<CrmResult> {
  const phone = whatsappE164(input.phone);
  if (!phone) return { ok: false, message: "Informe o WhatsApp com DDD antes de enviar." };
  try {
    const cfg = await config();
    const { contactId, sourceId } = await contactFor(cfg, phone, input.name);
    const conversationId = await conversationFor(cfg, contactId, sourceId);
    await call(cfg.url, cfg.token, `/api/v1/accounts/${cfg.accountId}/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { content: input.text, message_type: "outgoing", private: false },
    });
    return { ok: true, message: "Mensagem enviada pelo WhatsApp da Goldfinger." };
  } catch (error) {
    if (error instanceof CrmError) {
      if (/não foi aceita|não achei/i.test(error.message)) cached = null;
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Não foi possível enviar pelo CRM. Tente de novo." };
  }
}
