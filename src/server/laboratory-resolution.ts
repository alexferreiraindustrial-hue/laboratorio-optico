import type { SupabaseClient } from "@supabase/supabase-js";
import { PENDING_LABORATORY, PENDING_LABORATORY_CODE, PENDING_LABORATORY_NAME } from "@/lib/domain/laboratories";

/** Resolves an explicit save choice using the caller's RLS; never changes existing orders. */
export async function resolveLaboratory(supabase: SupabaseClient, value: string): Promise<{ id: string; error?: never } | { id?: never; error: string }> {
  if (value !== PENDING_LABORATORY) return { id: value };
  const find = () => supabase.from("laboratories").select("id,active").eq("code", PENDING_LABORATORY_CODE).maybeSingle();
  const current = await find();
  if (current.error) return { error: "Não foi possível consultar o laboratório a definir." };
  if (current.data) return current.data.active ? { id: current.data.id } : { error: "O cadastro A definir está inativo. Solicite a ativação ao administrador." };
  const created = await supabase.from("laboratories").insert({ name: PENDING_LABORATORY_NAME, code: PENDING_LABORATORY_CODE, color: "#6E6A63", active: true, notes: "Fornecedor ainda não escolhido. Atualizar individualmente na OS quando definido." }).select("id").single();
  if (created.data && !created.error) return { id: created.data.id };
  if (created.error?.code === "23505") {
    const retry = await find();
    if (!retry.error && retry.data?.active) return { id: retry.data.id };
  }
  return { error: "Peça ao administrador para cadastrar o laboratório A definir, ou escolha um laboratório existente." };
}
