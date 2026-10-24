"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/lib/domain/permissions";
import { FIVE_S, FIVE_S_KEYS, KAIZEN_CATEGORIES, senseScore, type LeanSettings } from "@/lib/domain/lean";
import type { ActionResult } from "@/lib/types";
import { actionError, requireProfile } from "./session";

const KAIZEN_STATUS = ["ideia", "em_teste", "verificacao", "padronizada", "descartada"] as const;

const kaizenSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(3, "Dê um título com pelo menos 3 letras.").max(140),
  problem: z.string().trim().min(3, "Descreva o problema observado.").max(2000),
  proposal: z.string().trim().max(2000).default(""),
  area: z.string().trim().min(2).max(80).default("Geral"),
  category: z.enum(Object.keys(KAIZEN_CATEGORIES) as [keyof typeof KAIZEN_CATEGORIES, ...(keyof typeof KAIZEN_CATEGORIES)[]]),
  impact: z.coerce.number().int().min(1).max(3),
  effort: z.coerce.number().int().min(1).max(3),
  owner_id: z.string().uuid().optional().or(z.literal("")),
  root_cause: z.string().trim().max(500).optional(),
  result: z.string().trim().max(1000).optional(),
  gain_minutes_day: z.coerce.number().int().min(0).max(1440).optional().or(z.literal("")),
});

function revalidateLean() {
  revalidatePath("/melhoria");
  revalidatePath("/melhoria/kaizen");
  revalidatePath("/melhoria/5s");
}

export async function saveKaizen(formData: FormData): Promise<ActionResult> {
  const { supabase, role, user } = await requireProfile();
  if (role === "consulta") return { ok: false, message: "Perfil de consulta não registra melhorias." };
  const parsed = kaizenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const input = parsed.data;
  const whys = formData
    .getAll("why")
    .map((value) => String(value).trim())
    .filter(Boolean)
    .slice(0, 5);
  const row = {
    title: input.title,
    problem: input.problem,
    proposal: input.proposal,
    area: input.area,
    category: input.category,
    impact: input.impact,
    effort: input.effort,
    owner_id: input.owner_id || user.id,
    whys,
    root_cause: input.root_cause || null,
    result: input.result || null,
    gain_minutes_day: input.gain_minutes_day === "" || input.gain_minutes_day === undefined ? null : input.gain_minutes_day,
  };
  const query = input.id
    ? supabase.from("kaizen_ideas").update(row).eq("id", input.id).select("id").maybeSingle()
    : supabase.from("kaizen_ideas").insert({ ...row, created_by: user.id }).select("id").maybeSingle();
  const { data, error } = await query;
  if (error) return { ok: false, message: actionError(error, "Não foi possível salvar a melhoria.") ?? "" };
  if (!data) return { ok: false, message: "Você só pode editar melhorias suas ou das quais é responsável." };
  revalidateLean();
  return { ok: true, id: data.id as string, message: input.id ? "Melhoria atualizada." : "Melhoria registrada. Obrigado pela ideia!" };
}

export async function moveKaizen(id: string, status: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (role === "consulta") return { ok: false, message: "Perfil de consulta não altera melhorias." };
  if (!(KAIZEN_STATUS as readonly string[]).includes(status)) return { ok: false, message: "Etapa inválida." };
  const { data, error } = await supabase.from("kaizen_ideas").update({ status }).eq("id", id).select("id").maybeSingle();
  if (error) return { ok: false, message: actionError(error, "Não foi possível mover a melhoria.") ?? "" };
  if (!data) return { ok: false, message: "Só o gestor, o autor ou o responsável podem mover esta melhoria." };
  revalidateLean();
  return { ok: true };
}

export async function deleteKaizen(id: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "settings.write")) return { ok: false, message: "Somente gestores excluem melhorias." };
  const { error } = await supabase.from("kaizen_ideas").delete().eq("id", id);
  if (error) return { ok: false, message: actionError(error, "Não foi possível excluir.") ?? "" };
  revalidateLean();
  return { ok: true, message: "Melhoria excluída." };
}

export async function saveFiveSAudit(formData: FormData): Promise<ActionResult> {
  const { supabase, role, user } = await requireProfile();
  if (role === "consulta") return { ok: false, message: "Perfil de consulta não registra auditorias." };
  const area = String(formData.get("area") ?? "").trim();
  if (area.length < 2) return { ok: false, message: "Informe a área auditada." };
  const answers: Record<string, number[]> = {};
  const scores: Record<string, number> = {};
  for (const sense of FIVE_S) {
    const values = sense.questions.map((_, index) => {
      const raw = Number(formData.get(`${sense.key}_${index}`));
      return Number.isFinite(raw) ? Math.max(0, Math.min(2, Math.round(raw))) : 0;
    });
    answers[sense.key] = values;
    scores[sense.key] = senseScore(values);
  }
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
  const { error } = await supabase.from("five_s_audits").insert({
    area: area.slice(0, 80),
    auditor_id: user.id,
    answers,
    notes,
    ...Object.fromEntries(FIVE_S_KEYS.map((key) => [key, scores[key]])),
  });
  if (error) return { ok: false, message: actionError(error, "Não foi possível salvar a auditoria.") ?? "" };
  revalidateLean();
  return { ok: true, message: "Auditoria 5S registrada." };
}

export async function saveLeanSettings(value: LeanSettings): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "settings.write")) return { ok: false, message: "Somente gestores alteram os limites." };
  const wip = Object.fromEntries(
    Object.entries(value.wip ?? {})
      .map(([key, limit]) => [key, Math.max(0, Math.min(999, Math.round(Number(limit) || 0)))])
      .filter(([, limit]) => (limit as number) > 0),
  );
  const minutes = Math.max(0, Math.min(1440, Math.round(Number(value.available_minutes_per_day) || 0)));
  const { error } = await supabase.rpc("upsert_setting", {
    p_key: "lean",
    p_value: { wip, available_minutes_per_day: minutes || null },
  });
  if (error) return { ok: false, message: actionError(error, "Não foi possível salvar.") ?? "" };
  revalidatePath("/laboratorio");
  revalidatePath("/melhoria");
  revalidatePath("/melhoria/indicadores");
  return { ok: true, message: "Limites salvos." };
}
