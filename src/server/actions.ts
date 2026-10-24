"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dateTimeLocalToIso } from "@/lib/domain/calendar";
import { can } from "@/lib/domain/permissions";
import { parseDiopterToCents } from "@/lib/domain/powers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";
import { movementSchema, orderFormSchema, stockFormSchema } from "@/lib/validation/forms";
import { actionError, requireProfile } from "./session";

function lensSpec(input: {
  odSphere?: string;
  odCylinder?: string;
  odAxis?: string;
  oeSphere?: string;
  oeCylinder?: string;
  oeAxis?: string;
  addition?: string;
  frame?: string;
  lensNotes?: string;
}) {
  return {
    od_sphere: input.odSphere?.trim() || "",
    od_cylinder: input.odCylinder?.trim() || "",
    od_axis: input.odAxis?.trim() || "",
    oe_sphere: input.oeSphere?.trim() || "",
    oe_cylinder: input.oeCylinder?.trim() || "",
    oe_axis: input.oeAxis?.trim() || "",
    addition: input.addition?.trim() || "",
    frame: input.frame?.trim() || "",
    lens_notes: input.lensNotes?.trim() || "",
  };
}

function emptyToNull(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

export async function signIn(formData: FormData) {
  const { supabase } = await (async () => {
    const { createClient } = await import("@/lib/supabase/server");
    return { supabase: await createClient() };
  })();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false as const, message: "E-mail ou senha inválidos." };
  redirect("/dashboard");
}

export async function signOut() {
  const { supabase } = await requireProfile();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createFirstAdmin(formData: FormData): Promise<ActionResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: exists, error: existsError } = await supabase.rpc("has_any_user");
  if (existsError) return { ok: false, message: existsError.message };
  if (exists) return { ok: false, message: "O acesso inicial já foi criado. Entre com seu usuário." };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!email || password.length < 8 || fullName.length < 3) {
    return { ok: false, message: "Informe nome, e-mail e uma senha com pelo menos 8 caracteres." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { ok: false, message: error.message };
  if (!data.session) {
    return {
      ok: true,
      message: "Conta criada. Confirme o e-mail se a confirmação estiver ativa no Supabase e depois entre no sistema. Este usuário será o administrador.",
    };
  }
  redirect("/dashboard");
}

export async function createManagedUser(formData: FormData): Promise<ActionResult> {
  const { role } = await requireProfile();
  if (!can(role, "users.manage")) return { ok: false, message: "Apenas o administrador cadastra usuários." };
  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      message: "Defina SUPABASE_SERVICE_ROLE_KEY no servidor para cadastrar usuários por aqui.",
    };
  }
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const nextRole = String(formData.get("role") ?? "consulta");
  if (!email || password.length < 8 || fullName.length < 3) {
    return { ok: false, message: "Informe nome, e-mail e uma senha com pelo menos 8 caracteres." };
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) return { ok: false, message: error?.message ?? "Não foi possível criar o usuário." };
  if (nextRole !== "consulta") {
    const { supabase } = await requireProfile();
    const { error: roleError } = await supabase.from("profiles").update({ role: nextRole }).eq("id", data.user.id);
    if (roleError) return { ok: false, message: roleError.message };
  }
  revalidatePath("/configuracoes");
  return { ok: true, message: "Usuário criado." };
}

export async function updateUserAccess(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "users.manage")) return { ok: false, message: "Apenas o administrador altera perfis." };
  const id = String(formData.get("id") ?? "");
  const nextRole = String(formData.get("role") ?? "");
  const active = formData.get("active") === "true";
  const { error } = await supabase.from("profiles").update({ role: nextRole, active }).eq("id", id);
  if (error) return { ok: false, message: actionError(error, "Não foi possível atualizar o usuário.") ?? "" };
  revalidatePath("/configuracoes");
  return { ok: true, message: "Acesso atualizado." };
}

export async function saveOrder(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "orders.write")) return { ok: false, message: "Sem permissão para cadastrar OS." };
  const parsed = orderFormSchema.safeParse({
    clientName: formData.get("clientName"),
    laboratoryId: formData.get("laboratoryId"),
    sellerId: formData.get("sellerId") || "",
    storeId: formData.get("storeId") || "",
    enteredAt: formData.get("enteredAt"),
    dueAt: formData.get("dueAt") || "",
    notes: formData.get("notes") || "",
    serviceDescription: formData.get("serviceDescription"),
    externalOrderId: formData.get("externalOrderId") || "",
    priority: formData.get("priority") || "normal",
    status: formData.get("status") || "aguardando_lentes",
    odSphere: formData.get("odSphere") || "",
    odCylinder: formData.get("odCylinder") || "",
    odAxis: formData.get("odAxis") || "",
    oeSphere: formData.get("oeSphere") || "",
    oeCylinder: formData.get("oeCylinder") || "",
    oeAxis: formData.get("oeAxis") || "",
    addition: formData.get("addition") || "",
    frame: formData.get("frame") || "",
    lensNotes: formData.get("lensNotes") || "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const id = String(formData.get("id") ?? "");
  const payload = {
    p_client_name: parsed.data.clientName,
    p_seller_id: emptyToNull(parsed.data.sellerId),
    p_store_id: emptyToNull(parsed.data.storeId),
    p_laboratory_id: parsed.data.laboratoryId,
    p_entered_at: dateTimeLocalToIso(parsed.data.enteredAt),
    p_due_at: parsed.data.dueAt ? dateTimeLocalToIso(parsed.data.dueAt) : null,
    p_notes: emptyToNull(parsed.data.notes),
    p_service_description: parsed.data.serviceDescription,
    p_external_order_id: emptyToNull(parsed.data.externalOrderId),
    p_priority: parsed.data.priority,
    p_lens_spec: lensSpec(parsed.data),
  };

  if (id) {
    const { error } = await supabase.rpc("update_service_order", { p_order_id: id, ...payload });
    if (error) return { ok: false, message: actionError(error, "Não foi possível salvar a OS.") ?? "" };
    revalidatePath("/laboratorio");
    revalidatePath(`/laboratorio/${id}`);
    revalidatePath("/dashboard");
    return { ok: true, id, message: "OS atualizada." };
  }

  const { data, error } = await supabase.rpc("create_service_order", {
    ...payload,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, message: actionError(error, "Não foi possível abrir a OS.") ?? "" };
  revalidatePath("/laboratorio");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id as string, message: `OS ${data.number} aberta.` };
}

export async function changeOrderStatus(orderId: string, status: string, note: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "orders.status")) return { ok: false, message: "Sem permissão para movimentar a OS." };
  const { error } = await supabase.rpc("change_order_status", {
    p_order_id: orderId,
    p_to: status,
    p_note: note,
  });
  if (error) return { ok: false, message: actionError(error, "Não foi possível mudar o status.") ?? "" };
  revalidatePath("/laboratorio");
  revalidatePath("/montagem");
  revalidatePath("/dashboard");
  revalidatePath(`/laboratorio/${orderId}`);
  revalidatePath(`/montagem/${orderId}`);
  return { ok: true, message: "Status atualizado." };
}

export async function advanceStep(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "assembly.write")) return { ok: false, message: "Sem permissão para registrar a etapa." };
  const orderId = String(formData.get("orderId") ?? "");
  const measurements = {
    conferido: String(formData.get("conferido") ?? ""),
    divergencia: String(formData.get("divergencia") ?? ""),
  };
  const { error } = await supabase.rpc("advance_assembly_step", {
    p_order_id: orderId,
    p_step_key: String(formData.get("stepKey") ?? ""),
    p_action: String(formData.get("action") ?? ""),
    p_notes: String(formData.get("notes") ?? ""),
    p_measurements: measurements,
    p_reason: String(formData.get("reason") ?? ""),
  });
  if (error) return { ok: false, message: actionError(error, "Não foi possível registrar a etapa.") ?? "" };
  revalidatePath(`/montagem/${orderId}`);
  revalidatePath("/montagem");
  revalidatePath("/laboratorio");
  revalidatePath("/dashboard");
  return { ok: true, message: "Etapa registrada." };
}

export async function saveOccurrence(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "quality.write")) return { ok: false, message: "Sem permissão para registrar ocorrência." };
  const orderId = String(formData.get("orderId") ?? "");
  const { error } = await supabase.rpc("register_quality_occurrence", {
    p_order_id: orderId,
    p_category_id: String(formData.get("categoryId") ?? ""),
    p_step_key: String(formData.get("stepKey") ?? ""),
    p_description: String(formData.get("description") ?? ""),
    p_severity: String(formData.get("severity") ?? "media"),
    p_corrective_action: String(formData.get("correctiveAction") ?? ""),
  });
  if (error) return { ok: false, message: actionError(error, "Não foi possível registrar a ocorrência.") ?? "" };
  revalidatePath(`/montagem/${orderId}`);
  revalidatePath("/relatorios");
  revalidatePath("/dashboard");
  return { ok: true, message: "Ocorrência registrada." };
}

export async function updateOccurrence(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "quality.write")) return { ok: false, message: "Sem permissão para atualizar a ocorrência." };
  const orderId = String(formData.get("orderId") ?? "");
  const { error } = await supabase.rpc("update_quality_occurrence", {
    p_id: String(formData.get("id") ?? ""),
    p_status: String(formData.get("status") ?? ""),
    p_corrective_action: String(formData.get("correctiveAction") ?? ""),
    p_closing_note: String(formData.get("closingNote") ?? ""),
  });
  if (error) return { ok: false, message: actionError(error, "Não foi possível atualizar a ocorrência.") ?? "" };
  revalidatePath(`/montagem/${orderId}`);
  revalidatePath("/relatorios");
  revalidatePath("/dashboard");
  return { ok: true, message: "Ocorrência atualizada. O histórico foi mantido." };
}

function centsFromMoney(value?: string) {
  if (!value?.trim()) return null;
  const normalized = value.trim().replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", ".");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100);
}

export async function saveStockItem(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "stock.write")) return { ok: false, message: "Sem permissão para cadastrar lentes." };
  const parsed = stockFormSchema.safeParse({
    manufacturer: formData.get("manufacturer") || "",
    brand: formData.get("brand") || "",
    material: formData.get("material") || "",
    refractiveIndex: formData.get("refractiveIndex") || "",
    treatment: formData.get("treatment") || "",
    color: formData.get("color") || "",
    diameterMm: formData.get("diameterMm") || "",
    sphere: formData.get("sphere"),
    cylinder: formData.get("cylinder"),
    addition: formData.get("addition") || "",
    lensType: formData.get("lensType") || "",
    lotCode: formData.get("lotCode") || "",
    location: formData.get("location") || "",
    minQty: formData.get("minQty") || 0,
    idealQty: formData.get("idealQty") || 0,
    initialQty: formData.get("initialQty") || 0,
    unitCost: formData.get("unitCost") || "",
    notes: formData.get("notes") || "",
    isSpecial: formData.get("isSpecial") === "true",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const sphere = parseDiopterToCents(parsed.data.sphere);
  const cylinder = parseDiopterToCents(parsed.data.cylinder);
  const addition = parsed.data.addition ? parseDiopterToCents(parsed.data.addition) : null;
  if (sphere == null || cylinder == null || (parsed.data.addition && addition == null)) {
    return { ok: false, message: "Use graus com duas casas, como -1,25 ou 0,00." };
  }

  const { data, error } = await supabase
    .from("lens_prescription_stock")
    .insert({
      manufacturer: emptyToNull(parsed.data.manufacturer),
      brand: emptyToNull(parsed.data.brand),
      material: emptyToNull(parsed.data.material),
      refractive_index: parsed.data.refractiveIndex ? Number(parsed.data.refractiveIndex.replace(",", ".")) : null,
      treatment: emptyToNull(parsed.data.treatment),
      color: emptyToNull(parsed.data.color),
      diameter_mm: parsed.data.diameterMm ? Number(parsed.data.diameterMm.replace(",", ".")) : null,
      sphere_cents: sphere,
      cylinder_cents: cylinder,
      addition_cents: addition,
      lens_type: emptyToNull(parsed.data.lensType),
      lot_code: emptyToNull(parsed.data.lotCode),
      location: emptyToNull(parsed.data.location),
      is_special: Boolean(parsed.data.isSpecial),
      min_qty: parsed.data.minQty,
      ideal_qty: parsed.data.idealQty,
      current_qty: 0,
      unit_cost_cents: centsFromMoney(parsed.data.unitCost),
      notes: emptyToNull(parsed.data.notes),
    })
    .select("id, public_code")
    .single();
  if (error) return { ok: false, message: actionError(error, "Não foi possível cadastrar a lente.") ?? "" };

  if (parsed.data.initialQty > 0) {
    const movement = await supabase.rpc("apply_stock_movement", {
      p_stock_id: data.id,
      p_type: "entrada",
      p_quantity: parsed.data.initialQty,
      p_reason: "Entrada inicial do cadastro",
      p_order_id: null,
      p_lot: emptyToNull(parsed.data.lotCode),
      p_allow_negative: false,
      p_idempotency_key: `entrada-inicial:${data.id}`,
    });
    if (movement.error) return { ok: false, message: actionError(movement.error, "O item foi criado, mas a entrada falhou.") ?? "" };
  }

  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id, message: `Lente ${data.public_code} cadastrada.` };
}

export async function moveStock(formData: FormData): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  const parsed = movementSchema.safeParse({
    stockId: formData.get("stockId"),
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
    orderId: formData.get("orderId") || "",
    lot: formData.get("lot") || "",
    allowNegative: formData.get("allowNegative") === "true",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (parsed.data.type === "consumo" && !can(role, "stock.consume")) {
    return { ok: false, message: "Sem permissão para consumir lentes." };
  }
  if (parsed.data.type !== "consumo" && !can(role, "stock.write")) {
    return { ok: false, message: "Sem permissão para movimentar o estoque." };
  }
  const { error } = await supabase.rpc("apply_stock_movement", {
    p_stock_id: parsed.data.stockId,
    p_type: parsed.data.type,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason,
    p_order_id: emptyToNull(parsed.data.orderId),
    p_lot: emptyToNull(parsed.data.lot),
    p_allow_negative: Boolean(parsed.data.allowNegative),
    p_idempotency_key:
      parsed.data.type === "consumo" && parsed.data.orderId
        ? `consumo:${parsed.data.orderId}:${parsed.data.stockId}`
        : null,
  });
  if (error) return { ok: false, message: actionError(error, "Não foi possível movimentar o estoque.") ?? "" };
  revalidatePath("/estoque");
  revalidatePath(`/estoque/${parsed.data.stockId}`);
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  if (parsed.data.orderId) revalidatePath(`/montagem/${parsed.data.orderId}`);
  return { ok: true, message: "Movimentação registrada." };
}

export async function updateThresholds(ids: string[], minQty: number, idealQty: number): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "stock.write")) return { ok: false, message: "Sem permissão para ajustar o mínimo." };
  const { error } = await supabase.rpc("set_stock_thresholds", {
    p_ids: ids,
    p_min_qty: minQty,
    p_ideal_qty: idealQty,
  });
  if (error) return { ok: false, message: actionError(error, "Não foi possível atualizar a reposição.") ?? "" };
  revalidatePath("/estoque");
  return { ok: true, message: "Parâmetros de reposição atualizados." };
}

export async function saveSimpleRecord(
  table: "laboratories" | "sellers" | "quality_categories" | "production_goals",
  values: Record<string, unknown>,
  id?: string,
): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "settings.write")) return { ok: false, message: "Sem permissão para alterar configurações." };
  const query = id
    ? supabase.from(table).update(values).eq("id", id)
    : supabase.from(table).insert(values);
  const { error } = await query;
  if (error) return { ok: false, message: actionError(error, "Não foi possível salvar.") ?? "" };
  revalidatePath("/configuracoes");
  revalidatePath("/laboratorio");
  revalidatePath("/dashboard");
  return { ok: true, message: "Registro salvo." };
}

export async function saveSetting(key: string, value: unknown): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "settings.write")) return { ok: false, message: "Sem permissão para alterar configurações." };
  const { error } = await supabase.rpc("upsert_setting", { p_key: key, p_value: value });
  if (error) return { ok: false, message: actionError(error, "Não foi possível salvar a configuração.") ?? "" };
  revalidatePath("/configuracoes");
  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  return { ok: true, message: "Configuração salva." };
}

export async function removeAttachment(id: string, path: string, orderId: string): Promise<ActionResult> {
  const { supabase, role, user } = await requireProfile();
  const { data: attachment } = await supabase
    .from("attachments")
    .select("uploaded_by")
    .eq("id", id)
    .maybeSingle();
  const owns = attachment?.uploaded_by === user.id;
  if (!owns && !can(role, "attachments.delete_any")) {
    return { ok: false, message: "Sem permissão para excluir este anexo." };
  }
  const { error } = await supabase
    .from("attachments")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id);
  if (error) return { ok: false, message: actionError(error, "Não foi possível excluir o anexo.") ?? "" };
  await supabase.storage.from("lab-files").remove([path]);
  revalidatePath(`/laboratorio/${orderId}`);
  revalidatePath(`/montagem/${orderId}`);
  return { ok: true, message: "Anexo excluído. O registro de exclusão foi mantido." };
}
