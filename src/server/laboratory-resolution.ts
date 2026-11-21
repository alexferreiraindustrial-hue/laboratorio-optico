import type { SupabaseClient } from "@supabase/supabase-js";
import { INTERNAL_MAINTENANCE, INTERNAL_MAINTENANCE_CODE, INTERNAL_MAINTENANCE_NAME, PENDING_LABORATORY, PENDING_LABORATORY_CODE, PENDING_LABORATORY_NAME } from "@/lib/domain/laboratories";

/** Resolves an explicit save choice using the caller's RLS; never changes existing orders. */
export async function resolveLaboratory(supabase: SupabaseClient, value: string): Promise<{ id: string; error?: never } | { id?: never; error: string }> {
  if (value !== PENDING_LABORATORY && value !== INTERNAL_MAINTENANCE) return { id: value };
  const internal = value === INTERNAL_MAINTENANCE;
  const code = internal ? INTERNAL_MAINTENANCE_CODE : PENDING_LABORATORY_CODE;
  const name = internal ? INTERNAL_MAINTENANCE_NAME : PENDING_LABORATORY_NAME;
  const label = internal ? INTERNAL_MAINTENANCE_NAME : "A definir";
  const find = () => supabase.from("laboratories").select("id,active").eq("code", code).maybeSingle();
  const current = await find();
  if (current.error) return { error: `Não foi possível consultar o cadastro ${label}.` };
  if (current.data) return current.data.active ? { id: current.data.id } : { error: `O cadastro ${label} está inativo. Solicite a ativação ao administrador.` };
  const created = await supabase.from("laboratories").insert({ name, code, color: "#6E6A63", active: true, notes: internal ? "Serviços internos de ajuste e manutenção, sem pedido de lentes." : "Fornecedor ainda não escolhido. Atualizar individualmente na OS quando definido." }).select("id").single();
  if (created.data && !created.error) return { id: created.data.id };
  if (created.error?.code === "23505") {
    const retry = await find();
    if (!retry.error && retry.data?.active) return { id: retry.data.id };
  }
  return { error: `Peça ao administrador para cadastrar o laboratório ${label}${internal ? " e tente novamente." : ", ou escolha um laboratório existente."}` };
}
