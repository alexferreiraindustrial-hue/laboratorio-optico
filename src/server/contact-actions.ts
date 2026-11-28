"use server";
import { revalidatePath } from "next/cache";
import { requireProfile, actionError } from "./session";
import { can } from "@/lib/domain/permissions";
import { feedbackMessage } from "@/lib/domain/client-followup";
import { phoneDigits, readyMessage, validPhone } from "@/lib/domain/client-contact";
import { crmConfigured, sendCrmWhatsApp } from "./crm";
import type { ActionResult } from "@/lib/types";

function refresh(id?: string) {
  for (const path of ["/avisos", "/pos-venda", "/laboratorio", "/inicio"]) revalidatePath(path);
  if (id) revalidatePath(`/laboratorio/${id}`);
}

export async function crmReady() {
  return crmConfigured();
}

/** Grava o WhatsApp do cliente na OS. */
export async function saveClientPhone(id: string, phone: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "orders.write")) return { ok: false, message: "Sem permissão." };
  if (phoneDigits(phone) && !validPhone(phone)) return { ok: false, message: "Confira o telefone com DDD." };
  const { error } = await supabase.rpc("set_order_client_phone", { p_order_id: id, p_phone: phone });
  if (error) return { ok: false, message: actionError(error, "Não foi possível salvar o telefone.") ?? "" };
  refresh(id);
  return { ok: true, message: phoneDigits(phone) ? "Telefone do cliente salvo." : "Telefone do cliente removido." };
}

/** Avisa o cliente pelo CRM que os óculos estão prontos e registra o aviso na OS. */
export async function notifyClientReady(id: string, phone?: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "orders.write")) return { ok: false, message: "Sem permissão." };
  const { data: order, error } = await supabase
    .from("service_orders")
    .select("id,client_name,status,completed_at,client_phone")
    .eq("id", id)
    .maybeSingle();
  if (error || !order) return { ok: false, message: "OS não encontrada." };
  if (order.status !== "pronto" || !order.completed_at) return { ok: false, message: "Só dá para avisar quando a OS estiver pronta na gaveta." };
  const target = phone?.trim() ? phone : order.client_phone;
  if (!validPhone(target)) return { ok: false, message: "Informe o WhatsApp do cliente com DDD." };
  if (phoneDigits(target) !== phoneDigits(order.client_phone)) {
    const saved = await supabase.rpc("set_order_client_phone", { p_order_id: id, p_phone: target });
    if (saved.error) return { ok: false, message: actionError(saved.error, "Não foi possível salvar o telefone.") ?? "" };
  }
  const sent = await sendCrmWhatsApp({ phone: target, name: order.client_name, text: readyMessage(order.client_name) });
  if (!sent.ok) return sent;
  await supabase.rpc("mark_order_notice", { p_order_id: id, p_kind: "ready", p_event_at: order.completed_at, p_recipient: "client" });
  refresh(id);
  return { ok: true, message: "Cliente avisado pelo WhatsApp da Goldfinger." };
}

/** Envia a mensagem do pós-venda pelo CRM e marca como contato feito. */
export async function sendFollowupMessage(followupId: string, phone: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!["admin", "gestor"].includes(role)) return { ok: false, message: "Sem permissão." };
  const { data: row, error } = await supabase
    .from("client_delivery_followups")
    .select("id,order_id,outcome,feedback_note,client_phone,updated_at")
    .eq("id", followupId)
    .maybeSingle();
  if (error || !row) return { ok: false, message: "Pós-venda não encontrado. Atualize a tela." };
  const target = phone?.trim() ? phone : row.client_phone;
  if (!validPhone(target)) return { ok: false, message: "Informe o WhatsApp do cliente com DDD." };
  const { data: order } = await supabase.from("service_orders").select("client_name").eq("id", row.order_id).maybeSingle();
  const name = order?.client_name ?? "";
  const sent = await sendCrmWhatsApp({ phone: target, name, text: feedbackMessage(name) });
  if (!sent.ok) return sent;
  const { error: saveError } = await supabase.rpc("update_client_followup", {
    p_id: row.id,
    p_outcome: row.outcome ?? "contato_realizado",
    p_note: row.feedback_note ?? "",
    p_phone: phoneDigits(target),
    p_expected_updated_at: row.updated_at,
  });
  refresh(row.order_id);
  if (saveError) return { ok: true, message: "Mensagem enviada, mas não consegui marcar o contato. Atualize a tela e marque à mão." };
  return { ok: true, message: "Mensagem do pós-venda enviada e contato registrado." };
}

const NOTICE_KINDS = ["ready", "received", "lenses", "vta", "due", "missing_ref"];

/** Envia para a vendedora a lista da central de avisos (ex.: prontos do dia na gaveta dela) e registra o aviso de cada OS. */
export async function sendSellerNotice(sellerId: string, kind: string, orders: { id: string; eventAt: string | null }[], text: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "orders.write")) return { ok: false, message: "Sem permissão." };
  if (!NOTICE_KINDS.includes(kind)) return { ok: false, message: "Tipo de aviso inválido." };
  if (!orders.length) return { ok: false, message: "Nenhum serviço selecionado para esta vendedora." };
  if (!text.trim() || text.length > 6000) return { ok: false, message: "Mensagem vazia ou longa demais." };
  const { data: seller } = await supabase.from("sellers").select("id,name,phone,whatsapp").eq("id", sellerId).maybeSingle();
  if (!seller) return { ok: false, message: "Vendedora sem cadastro. Abra Vendedores e confira." };
  const phone = seller.whatsapp || seller.phone;
  if (!validPhone(phone)) return { ok: false, message: `Cadastre o WhatsApp de ${seller.name} em Vendedores.` };
  const sent = await sendCrmWhatsApp({ phone, name: seller.name, text });
  if (!sent.ok) return sent;
  for (const order of orders) {
    if (!order.eventAt) continue;
    await supabase.rpc("mark_order_notice", { p_order_id: order.id, p_kind: kind, p_event_at: order.eventAt, p_recipient: "seller" });
  }
  refresh();
  return { ok: true, message: `Mensagem enviada para ${seller.name}.` };
}

/** Coloca no pós-venda a OS que acabou de sair do laboratório (só com número da loja). */
export async function ensureClientFollowup(id: string) {
  const { supabase, role } = await requireProfile();
  if (!can(role, "orders.write")) return { ok: false };
  const { data, error } = await supabase.rpc("ensure_client_followup", { p_order_id: id });
  return { ok: !error, added: Boolean(data && (data as { id?: string }).id) };
}

/** Lista simples para cadastrar o WhatsApp das vendedoras. */
export async function listSellerContacts() {
  const { supabase, role } = await requireProfile();
  if (!can(role, "parties.write")) return [];
  const { data } = await supabase.from("sellers").select("id,name,whatsapp,phone").eq("active", true).order("name");
  return (data ?? []) as { id: string; name: string; whatsapp: string | null; phone: string | null }[];
}

/** Grava só o WhatsApp da vendedora (não mexe no resto do cadastro). */
export async function saveSellerWhatsapp(id: string, whatsapp: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "parties.write")) return { ok: false, message: "Sem permissão para alterar vendedores." };
  const digits = phoneDigits(whatsapp);
  if (digits && !validPhone(digits)) return { ok: false, message: "Confira o WhatsApp com DDD." };
  const { error } = await supabase.from("sellers").update({ whatsapp: digits || null }).eq("id", id);
  if (error) return { ok: false, message: "Não foi possível salvar o WhatsApp." };
  refresh();
  revalidatePath("/vendedores");
  return { ok: true, message: digits ? "WhatsApp salvo." : "WhatsApp removido." };
}

/** Mensagem ao cliente da OS pelo WhatsApp da Goldfinger (CRM). "pronto" também registra o aviso de pronto. */
export async function sendClientMessage(id: string, text: string, kind: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "orders.write")) return { ok: false, message: "Sem permissão." };
  const body = text.trim();
  if (body.length < 5) return { ok: false, message: "Escreva a mensagem antes de enviar." };
  if (body.length > 2000) return { ok: false, message: "Use até 2000 caracteres." };
  const { data: order, error } = await supabase.from("service_orders").select("id,client_name,status,completed_at,client_phone").eq("id", id).maybeSingle();
  if (error || !order) return { ok: false, message: "OS não encontrada." };
  if (!validPhone(order.client_phone)) return { ok: false, message: "Esta OS não tem WhatsApp do cliente. Coloque em Editar dados." };
  const sent = await sendCrmWhatsApp({ phone: order.client_phone, name: order.client_name, text: body });
  if (!sent.ok) return sent;
  if (kind === "pronto" && order.status === "pronto" && order.completed_at) {
    await supabase.rpc("mark_order_notice", { p_order_id: id, p_kind: "ready", p_event_at: order.completed_at, p_recipient: "client" });
  }
  refresh(id);
  return { ok: true, message: `Mensagem enviada para ${order.client_name}.` };
}
