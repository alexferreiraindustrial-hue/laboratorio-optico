"use server";
// Auditoria: corrige a posição da OS para onde ela foi encontrada, passo a passo,
// usando as operações que o banco já tem. Só gestor e administrador.
import { revalidatePath } from "next/cache";
import { AUDIT_POSITIONS, auditPositionOf, describeAudit, planAudit, type AuditPosition } from "@/lib/domain/audit";
import type { ActionResult } from "@/lib/types";
import { actionError, requireProfile } from "./session";

const FIELDS = "id, status, frame_state, lens_arrived_at, updated_at, medical_review_required, medical_review_approved_at, express_minutes";
type Row = { id: string; status: string; frame_state: string | null; lens_arrived_at: string | null; updated_at: string; medical_review_required: boolean | null; medical_review_approved_at: string | null; express_minutes: number | null };

type MoveResult = ActionResult & { changed?: boolean; detail?: string; reactivated?: boolean };

/** Leva a OS para onde foi encontrada e registra o bipe na auditoria geral (se houver uma aberta). */
export async function auditMoveOrder(id: string, found: AuditPosition): Promise<MoveResult> {
  const result = await moveOrder(id, found);
  if (!result.ok) return result;
  const { supabase } = await requireProfile();
  const { data: before } = await supabase.from("service_orders").select("audit_off_at").eq("id", id).maybeSingle();
  const mark = await supabase.rpc("audit_mark_found", { p_order_id: id, p_position: found });
  const reactivated = !mark.error && Boolean((before as { audit_off_at?: string | null } | null)?.audit_off_at);
  if (reactivated) for (const path of ["/laboratorio", "/lentes", "/montagem", "/laboratorio/auditoria-geral"]) revalidatePath(path);
  return reactivated ? { ...result, reactivated, message: `${result.message} · estava em off, voltou a ficar ativa` } : result;
}

async function moveOrder(id: string, found: AuditPosition): Promise<MoveResult> {
  const { supabase, role } = await requireProfile();
  if (!["admin", "gestor", "montador"].includes(role)) return { ok: false, message: "Seu acesso não faz auditoria." };
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
  if (before === found) return { ok: true, changed: false, message: `Confere · ${AUDIT_POSITIONS[found]}` };

  const note = `Auditoria: OS encontrada em ${AUDIT_POSITIONS[found]}`;
  // Caminho direto: a função de reposição leva de qualquer etapa para qualquer posição.
  const direct = await supabase.rpc("reposition_order", { p_order_id: id, p_to: found, p_note: note });
  if (!direct.error) {
    for (const path of ["/laboratorio", "/lentes", "/montagem", "/entrega", "/inicio", "/dashboard", "/pdv", `/laboratorio/${id}`]) revalidatePath(path);
    return { ok: true, changed: true, message: `Corrigida: ${AUDIT_POSITIONS[before]} → ${AUDIT_POSITIONS[found]}` };
  }
  const missing = direct.error.code === "PGRST202" || /reposition_order/.test(direct.error.message);
  if (!missing) return { ok: false, message: actionError(direct.error, "Não foi possível corrigir a posição.") ?? "" };

  // Função ainda não instalada: tenta pelas operações normais do fluxo.
  const steps = planAudit(order, found);
  if (steps === null) return { ok: false, message: `Sem a correção de posição instalada no Supabase não dá para passar de ${AUDIT_POSITIONS[before]} para ${AUDIT_POSITIONS[found]}. Rode o arquivo funcao-mudar-posicao.sql.` };
  if (!steps.length) return { ok: true, changed: false, message: `Confere · ${AUDIT_POSITIONS[found]}` };

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
        return { ok: false, message: `Para levar de ${AUDIT_POSITIONS[before]} para ${AUDIT_POSITIONS[found]} falta instalar a correção de posição (funcao-mudar-posicao.sql) no Supabase.` };
      }
    }
    if (error) return { ok: false, message: actionError(error, "Não foi possível corrigir a posição.") ?? "" };
    try { order = await read(); } catch { break; }
  }
  for (const path of ["/laboratorio", "/lentes", "/montagem", "/entrega", "/inicio", "/dashboard", "/pdv", `/laboratorio/${id}`]) revalidatePath(path);
  return { ok: true, changed: true, message: `Corrigida: ${AUDIT_POSITIONS[before]} → ${AUDIT_POSITIONS[found]}`, detail: describeAudit(steps) };
}

// ---------------------------------------------------------------------------
// Auditoria geral: inicia, encerra (coloca em off as não encontradas) e reativa.
function refreshGeneral() {
  for (const path of ["/laboratorio", "/lentes", "/montagem", "/inicio", "/dashboard", "/avisos", "/laboratorio/auditoria-geral"]) revalidatePath(path);
}

export async function startGeneralAudit(): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!["admin", "gestor"].includes(role)) return { ok: false, message: "Somente administrador ou gestor inicia a auditoria geral." };
  const { error } = await supabase.rpc("start_general_audit");
  if (error) return { ok: false, message: actionError(error, "Não foi possível iniciar a auditoria. A atualização do banco já foi feita?") ?? "" };
  refreshGeneral();
  return { ok: true, message: "Auditoria geral iniciada. Agora é só bipar gaveta por gaveta." };
}

export async function finishGeneralAudit(offIds: string[]): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!["admin", "gestor"].includes(role)) return { ok: false, message: "Somente administrador ou gestor encerra a auditoria geral." };
  const { data, error } = await supabase.rpc("finish_general_audit", { p_off_ids: offIds });
  if (error) return { ok: false, message: actionError(error, "Não foi possível encerrar a auditoria.") ?? "" };
  refreshGeneral();
  const count = (data as { off_count?: number } | null)?.off_count ?? 0;
  return { ok: true, message: count ? `Auditoria encerrada. ${count} OS foram para off (dados guardados).` : "Auditoria encerrada sem colocar OS em off." };
}

export async function reactivateOrder(id: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!["admin", "gestor", "montador"].includes(role)) return { ok: false, message: "Seu acesso não reativa OS." };
  const { error } = await supabase.rpc("reactivate_order", { p_order_id: id });
  if (error) return { ok: false, message: actionError(error, "Não foi possível reativar a OS.") ?? "" };
  refreshGeneral();
  revalidatePath(`/laboratorio/${id}`);
  return { ok: true, message: "OS reativada. Ela voltou para a operação na mesma etapa." };
}
