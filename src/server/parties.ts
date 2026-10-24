"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/lib/domain/permissions";
import type { ActionResult } from "@/lib/types";
import { requireProfile } from "./session";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function digits(value: string | null) {
  if (!value) return null;
  const only = value.replace(/\D/g, "");
  return only.length ? only : null;
}

export async function saveStore(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "parties.write")) return { ok: false, message: "Sem permissão para cadastrar lojas." };
  const tradeName = clean(formData.get("tradeName"));
  if (!tradeName || tradeName.length < 2) return { ok: false, message: "Informe o nome fantasia da loja." };
  const cnpj = digits(clean(formData.get("cnpj")));
  if (cnpj && cnpj.length !== 14) return { ok: false, message: "O CNPJ deve ter 14 dígitos." };
  const payload = {
    trade_name: tradeName,
    legal_name: clean(formData.get("legalName")),
    cnpj,
    contact_name: clean(formData.get("contactName")),
    phone: clean(formData.get("phone")),
    whatsapp: clean(formData.get("whatsapp")),
    email: clean(formData.get("email")),
    address: clean(formData.get("address")),
    notes: clean(formData.get("notes")),
    active: formData.get("active") !== "false",
  };
  const id = clean(formData.get("id"));
  const query = id
    ? supabase.from("stores").update(payload).eq("id", id).select("id").single()
    : supabase.from("stores").insert(payload).select("id").single();
  const { data, error } = await query;
  if (error) return { ok: false, message: error.message };
  revalidatePath("/lojas");
  revalidatePath("/laboratorio");
  return { ok: true, id: data.id, message: id ? "Loja atualizada." : "Loja cadastrada." };
}

export async function saveSeller(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "parties.write")) return { ok: false, message: "Sem permissão para cadastrar vendedores." };
  const name = clean(formData.get("name"));
  if (!name || name.length < 2) return { ok: false, message: "Informe o nome completo do vendedor." };
  const storeIds = formData.getAll("storeId").map(String).filter(Boolean);
  const payload = {
    name,
    phone: clean(formData.get("phone")),
    whatsapp: clean(formData.get("whatsapp")),
    email: clean(formData.get("email")),
    notes: clean(formData.get("notes")),
    active: formData.get("active") !== "false",
  };
  const id = clean(formData.get("id"));
  const query = id
    ? supabase.from("sellers").update(payload).eq("id", id).select("id, name, public_code").single()
    : supabase.from("sellers").insert(payload).select("id, name, public_code").single();
  const { data, error } = await query;
  if (error || !data) return { ok: false, message: error?.message ?? "Não foi possível salvar o vendedor." };

  if (formData.has("storeId")) {
    const { error: clearError } = await supabase.from("seller_stores").delete().eq("seller_id", data.id);
    if (clearError) return { ok: false, message: clearError.message };
    if (storeIds.length) {
      const { error: linkError } = await supabase.from("seller_stores").insert(
        storeIds.map((storeId) => ({ seller_id: data.id, store_id: storeId })),
      );
      if (linkError) return { ok: false, message: linkError.message };
    }
  }

  revalidatePath("/vendedores");
  revalidatePath("/lojas");
  revalidatePath("/laboratorio");
  return { ok: true, id: data.id, message: id ? "Vendedor atualizado." : "Vendedor cadastrado." };
}

export async function issuePortalLink(subjectType: "store" | "seller", subjectId: string): Promise<ActionResult & { token?: string }> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "portal.manage")) return { ok: false, message: "Sem permissão para gerar links." };
  const { data, error } = await supabase.rpc("issue_portal_credential", {
    p_subject_type: subjectType,
    p_subject_id: subjectId,
  });
  if (error || typeof data !== "string") return { ok: false, message: error?.message ?? "Não foi possível gerar o link." };
  revalidatePath("/lojas");
  revalidatePath("/vendedores");
  return { ok: true, token: data, message: "Link gerado. Copie agora; ele não será mostrado de novo." };
}

export async function revokePortalLink(credentialId: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "portal.manage")) return { ok: false, message: "Sem permissão para revogar links." };
  const { error } = await supabase.rpc("revoke_portal_credential", { p_credential_id: credentialId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/lojas");
  revalidatePath("/vendedores");
  return { ok: true, message: "Link revogado." };
}

export async function replyMessage(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "messages.reply")) return { ok: false, message: "Sem permissão para responder recados." };
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.rpc("reply_order_message", {
    p_message_id: id,
    p_body: String(formData.get("reply") ?? ""),
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/recados");
  revalidatePath("/laboratorio");
  return { ok: true, message: "Resposta registrada." };
}

export async function viewMessage(id: string): Promise<void> {
  const { supabase, role } = await requireProfile();
  if (!role) return;
  await supabase.rpc("mark_message_viewed", { p_message_id: id });
}
