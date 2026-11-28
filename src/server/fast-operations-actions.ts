"use server";
import { revalidatePath } from "next/cache";
import { requireProfile, actionError } from "./session";
import { can } from "@/lib/domain/permissions";
import { resolveLaboratory } from "./laboratory-resolution";
import { INTERNAL_ASSEMBLY } from "@/lib/domain/laboratories";
function refresh(id?: string) {
  for (const path of [
    "/inicio",
    "/dashboard",
    "/montagem",
    "/laboratorio",
    "/entrega",
    "/pos-venda",
    "/avisos",
    ...(id ? [`/laboratorio/${id}`, `/montagem/${id}`] : []),
  ])
    revalidatePath(path);
}
export async function registerStageNote(
  id: string,
  step: string,
  description: string,
  correction: boolean,
) {
  const { supabase, role } = await requireProfile();
  if (!can(role, "quality.write"))
    return { ok: false, message: "Sem permissão." };
  const { error } = await supabase.rpc("register_order_stage_note", {
    p_order_id: id,
    p_step_key: step || null,
    p_description: description,
    p_correction: correction,
  });
  if (error)
    return {
      ok: false,
      message:
        actionError(error, "Não foi possível registrar.") ?? "Erro ao salvar.",
    };
  refresh(id);
  return {
    ok: true,
    message: correction
      ? "Problema registrado. Serviço enviado para correção."
      : "Registro salvo. O serviço permaneceu no mesmo lugar.",
  };
}
export async function createReadyOrder(input: {
  sellerId: string;
  storeId: string;
  orderRef: string;
  clientName: string;
  completedAt: string;
}) {
  const { supabase, role } = await requireProfile();
  if (!can(role, "orders.write"))
    return { ok: false, message: "Sem permissão." };
  const ref = input.orderRef?.trim();
  const name = input.clientName?.trim() || (ref ? `OS ${ref}` : "");
  if (
    !input.sellerId ||
    name.length < 2 ||
    name.length > 200 ||
    (ref?.length ?? 0) > 80 ||
    !Number.isFinite(Date.parse(input.completedAt)) ||
    Date.parse(input.completedAt) > Date.now() + 60000
  )
    return {
      ok: false,
      message:
        "Confira a vendedora, OS ou cliente e a data real em que ficou pronto.",
    };
  let store = input.storeId || null;
  if (!store) {
    const links = await supabase
      .from("seller_stores")
      .select("store_id")
      .eq("seller_id", input.sellerId)
      .limit(2);
    if (links.error)
      return {
        ok: false,
        message: "Não foi possível conferir a loja da vendedora.",
      };
    if (links.data?.length === 1) store = links.data[0].store_id;
  }
  const lab = await resolveLaboratory(supabase, INTERNAL_ASSEMBLY);
  if (lab.error) return { ok: false, message: lab.error };
  const { data, error } = await supabase.rpc("create_ready_service_order", {
    p_order: {
      p_client_name: name,
      p_seller_id: input.sellerId,
      p_store_id: store,
      p_laboratory_id: lab.id,
      p_entered_at: new Date().toISOString(),
      p_service_description: "Registro de passagem · serviço já pronto",
      p_external_order_id: ref || null,
      p_priority: "normal",
      p_notes:
        "Serviço pronto antes do cadastro. Etapas não marcadas como realizadas.",
    },
    p_completed_at: input.completedAt,
  });
  if (error)
    return {
      ok: false,
      message:
        actionError(error, "Não foi possível cadastrar o serviço pronto.") ??
        "Erro ao salvar.",
    };
  refresh();
  return {
    ok: true,
    message: `${data.number} registrado como pronto. Nenhum serviço anterior foi alterado.`,
    id: data.id as string,
  };
}
export async function confirmClientDelivery(
  id: string,
  phone: string,
  deliveredAt: string,
) {
  const { supabase, role } = await requireProfile();
  if (!can(role, "orders.deliver"))
    return { ok: false, message: "Sem permissão." };
  let target = phone;
  if (!target.replace(/\D/g, "")) {
    // Usa o WhatsApp já salvo na OS, quando houver (ex.: entrega pelo bipe).
    const saved = await supabase.from("service_orders").select("client_phone").eq("id", id).maybeSingle();
    if (!saved.error) target = (saved.data?.client_phone as string | null) ?? "";
  }
  const { error } = await supabase.rpc("confirm_client_delivery", {
    p_order_id: id,
    p_phone: target,
    p_delivered_at: deliveredAt,
  });
  if (error)
    return {
      ok: false,
      message:
        actionError(
          error,
          "Não foi possível confirmar a entrega ao cliente.",
        ) ?? "Erro ao salvar.",
    };
  refresh(id);
  return {
    ok: true,
    message:
      "Entrega ao cliente confirmada. Acompanhamento previsto para cinco dias depois desta data.",
  };
}
export async function updateClientFollowup(
  id: string,
  outcome: string | null,
  note: string,
  phone: string,
  version: string,
) {
  const { supabase, role } = await requireProfile();
  if (!can(role, "orders.deliver"))
    return { ok: false, message: "Sem permissão." };
  const { error } = await supabase.rpc("update_client_followup", {
    p_id: id,
    p_outcome: outcome,
    p_note: note,
    p_phone: phone,
    p_expected_updated_at: version,
  });
  if (error)
    return {
      ok: false,
      message:
        actionError(error, "Não foi possível salvar o pós-venda.") ??
        "Erro ao salvar.",
    };
  refresh();
  return {
    ok: true,
    message: "Acompanhamento salvo. A data de entrega não foi alterada.",
  };
}
