"use server";

import { revalidatePath } from "next/cache";
import { dateTimeLocalToIso } from "@/lib/domain/calendar";
import { BO_DECISIONS, type BoDecision } from "@/lib/domain/flow";
import type { ActionResult } from "@/lib/types";
import { actionError, requireProfile } from "./session";

const WRITERS = ["admin", "gestor", "montador"];

function refreshFlow() {
  revalidatePath("/lentes");
  revalidatePath("/assistencia");
  revalidatePath("/laboratorio");
  revalidatePath("/dashboard");
  revalidatePath("/rotina");
}

/** Previsão de chegada da lente informada pelo laboratório externo (data AAAA-MM-DD). */
export async function updateLensForecast(orderId: string, date: string | null, supplierRef: string | null): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!WRITERS.includes(role)) return { ok: false, message: "Seu perfil não altera a previsão." };
  let iso: string | null = null;
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Data inválida." };
    iso = dateTimeLocalToIso(`${date}T12:00`);
  }
  const { error } = await supabase
    .from("service_orders")
    .update({ lens_expected_at: iso, lens_supplier_ref: supplierRef?.trim().slice(0, 60) || null })
    .eq("id", orderId);
  if (error) return { ok: false, message: actionError(error, "Não foi possível salvar a previsão.") ?? "" };
  refreshFlow();
  return { ok: true, message: "Previsão da lente atualizada." };
}

export async function notifyOccurrence(id: string): Promise<ActionResult> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("mark_occurrence_notified", { p_id: id });
  if (error) return { ok: false, message: actionError(error, "Não foi possível registrar o aviso.") ?? "" };
  refreshFlow();
  return { ok: true, message: "Aviso registrado." };
}

export async function decideOccurrence(id: string, decision: BoDecision, note: string, lensDate: string | null): Promise<ActionResult> {
  const { supabase } = await requireProfile();
  if (!(decision in BO_DECISIONS)) return { ok: false, message: "Decisão inválida." };
  const { error } = await supabase.rpc("decide_occurrence", {
    p_id: id,
    p_decision: decision,
    p_note: note,
    p_lens_expected_at: lensDate ? dateTimeLocalToIso(`${lensDate}T12:00`) : null,
  });
  if (error) return { ok: false, message: actionError(error, "Não foi possível registrar a decisão.") ?? "" };
  refreshFlow();
  return { ok: true, message: `Decisão registrada: ${BO_DECISIONS[decision].label}.` };
}

export async function resolveOccurrence(id: string, note: string): Promise<ActionResult> {
  const { supabase } = await requireProfile();
  const { data: current } = await supabase.from("quality_occurrences").select("corrective_action").eq("id", id).maybeSingle();
  const { error } = await supabase.rpc("update_quality_occurrence", {
    p_id: id,
    p_status: "resolvida",
    p_corrective_action: current?.corrective_action ?? "",
    p_closing_note: note || "Assistência concluída",
  });
  if (error) return { ok: false, message: actionError(error, "Não foi possível encerrar o BO.") ?? "" };
  refreshFlow();
  return { ok: true, message: "BO encerrado. A OS pode seguir para a conferência." };
}

export async function toggleRoutineItem(itemKey: string, label: string, done: boolean): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (role === "consulta") return { ok: false, message: "Perfil de consulta não marca a rotina." };
  if (done) {
    const { error } = await supabase.from("routine_logs").insert({ kind: "checklist", item_key: itemKey.slice(0, 60), label: label.slice(0, 200) });
    if (error && !/duplicate/i.test(error.message)) return { ok: false, message: actionError(error, "Não foi possível marcar.") ?? "" };
  } else {
    const { error } = await supabase
      .from("routine_logs")
      .delete()
      .eq("kind", "checklist")
      .eq("item_key", itemKey)
      .eq("day", new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()));
    if (error) return { ok: false, message: actionError(error, "Não foi possível desmarcar.") ?? "" };
  }
  revalidatePath("/rotina");
  return { ok: true };
}

export async function logMotoboy(lenses: number | null, notes: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (role === "consulta") return { ok: false, message: "Perfil de consulta não registra chegadas." };
  const { count } = await supabase
    .from("routine_logs")
    .select("id", { count: "exact", head: true })
    .eq("kind", "motoboy")
    .eq("day", new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()));
  const { error } = await supabase.from("routine_logs").insert({
    kind: "motoboy",
    label: `${(count ?? 0) + 1}ª chegada do motoboy`,
    lenses_count: lenses == null || Number.isNaN(lenses) ? null : Math.max(0, Math.min(999, Math.round(lenses))),
    notes: notes.trim().slice(0, 1000) || null,
  });
  if (error) return { ok: false, message: actionError(error, "Não foi possível registrar a chegada.") ?? "" };
  revalidatePath("/rotina");
  return { ok: true, message: "Chegada do motoboy registrada." };
}

export async function addRoutineNote(text: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (role === "consulta") return { ok: false, message: "Perfil de consulta não registra anotações." };
  const label = text.trim().slice(0, 200);
  if (!label) return { ok: false, message: "Escreva a anotação." };
  const { error } = await supabase.from("routine_logs").insert({ kind: "nota", label });
  if (error) return { ok: false, message: actionError(error, "Não foi possível salvar.") ?? "" };
  revalidatePath("/rotina");
  return { ok: true };
}

export async function removeRoutineLog(id: string): Promise<ActionResult> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.from("routine_logs").delete().eq("id", id);
  if (error) return { ok: false, message: actionError(error, "Não foi possível remover.") ?? "" };
  revalidatePath("/rotina");
  return { ok: true };
}
