"use server";
// Auditoria: corrige a posição da OS para onde ela foi encontrada, passo a passo,
// usando as operações que o banco já tem. Só gestor e administrador.
import { revalidatePath } from "next/cache";
import { AUDIT_POSITIONS, auditPositionOf, describeAudit, planAudit, type AuditPosition } from "@/lib/domain/audit";
import type { ActionResult } from "@/lib/types";
import { actionError, requireProfile } from "./session";

const FIELDS = "id, status, frame_state, lens_arrived_at, updated_at, medical_review_required, medical_review_approved_at, express_minutes";
type Row = { id: string; status: string; frame_state: string | null; lens_arrived_at: string | null; updated_at: string; medical_review_required: boolean | null; medical_review_approved_at: string | null; express_minutes: number | null };

export async function auditMoveOrder(id: string, found: AuditPosition): Promise<ActionResult & { changed?: boolean; detail?: string }> {
  const { supabase, role } = await requireProfile();
  if (!["admin", "gestor"].includes(role)) return { ok: false, message: "A auditoria é feita por gestor ou administrador." };
  if (!(found in AUDIT_POSITIONS)) return { ok: false, message: "Escolha onde a OS foi encontrada." };
  const read = async () => {
    const { data, error } = await supabase.from("service_orders").select(FIELDS).eq("id", id).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "OS não encontrada.");
    return data as Row;
  };
  let order: Row;
  try { order = await read(); } catch (error) { return { ok: false, message: (error as Error).message }; }
  const before = auditPositionOf(order);
  if (!before) return { ok: false, message: "Esta OS não está em aberto no laboratório (entregue ou cancelada)." };
  const steps = planAudit(order, found);
  if (steps === null) return { ok: false, message: `Não há como passar de ${AUDIT_POSITIONS[before]} para ${AUDIT_POSITIONS[found]} por aqui. Abra a OS e corrija manualmente.` };
  if (!steps.length) return { ok: true, changed: false, message: `Confere · ${AUDIT_POSITIONS[found]}` };

  const note = `Auditoria: OS encontrada em ${AUDIT_POSITIONS[found]}`;
  for (const step of steps) {
    let error: { message: string; code?: string } | null = null;
    if (step.kind === "lente") ({ error } = await supabase.rpc("receive_order_lenses", { p_order_id: id }));
    else if (step.kind === "armacao") ({ error } = await supabase.rpc("receive_order_frame", { p_order_id: id, p_express_minutes: null }));
    else if (step.kind === "vta") {
      ({ error } = await supabase.rpc("configure_order_operations", { p_order_id: id, p_frame_state: "vta", p_express_minutes: order.express_minutes, p_expected_updated_at: order.updated_at }));
      if (!error) ({ error } = await supabase.rpc("receive_order_lenses", { p_order_id: id }));
    } else if (step.kind === "status") {
      if (order.status === "em_conferencia" && step.to === "pronto" && order.medical_review_required && !order.medical_review_approved_at) {
        ({ error } = await supabase.rpc("approve_medical_review", { p_order_id: id, p_note: `${note} (voltou do médico)`, p_expected_updated_at: order.updated_at }));
      } else {
        ({ error } = await supabase.rpc("change_order_status", { p_order_id: id, p_to: step.to, p_note: note }));
      }
    } else {
      ({ error } = await supabase.rpc("reposition_order", { p_order_id: id, p_to: step.to, p_note: note }));
      if (error && (error.code === "PGRST202" || /reposition_order/.test(error.message))) {
        return { ok: false, message: `Para levar de ${AUDIT_POSITIONS[before]} para ${AUDIT_POSITIONS[found]} falta instalar a função de mudar posição no Supabase.` };
      }
    }
    if (error) return { ok: false, message: actionError(error, "Não foi possível corrigir a posição.") ?? "" };
    try { order = await read(); } catch { break; }
  }
  for (const path of ["/laboratorio", "/lentes", "/montagem", "/entrega", "/inicio", "/dashboard", "/pdv", `/laboratorio/${id}`]) revalidatePath(path);
  return { ok: true, changed: true, message: `Corrigida: ${AUDIT_POSITIONS[before]} → ${AUDIT_POSITIONS[found]}`, detail: describeAudit(steps) };
}
