"use server";
// Corrigir a posição da OS (desfazer pronto por engano ou colocar em VTA). Só gestor e administrador.
import { revalidatePath } from "next/cache";
import { REPOSITION_LABEL, REPOSITION_ROLES, type RepositionTarget } from "@/lib/domain/reposition";
import type { ActionResult } from "@/lib/types";
import { actionError, requireProfile } from "./session";

export async function repositionOrder(id: string, to: RepositionTarget, note: string): Promise<ActionResult> {
  const { supabase, role } = await requireProfile();
  if (!REPOSITION_ROLES.includes(role)) return { ok: false, message: "Seu acesso não muda a posição da OS." };
  if (!(to in REPOSITION_LABEL)) return { ok: false, message: "Escolha para onde a OS vai." };
  const { error } = await supabase.rpc("reposition_order", { p_order_id: id, p_to: to, p_note: note.trim() });
  if (error) {
    // A função nova ainda não foi criada no banco de produção.
    if ((error as { code?: string }).code === "PGRST202" || /reposition_order/.test(error.message)) return { ok: false, message: "A correção de posição ainda não foi instalada no banco. Rode o arquivo funcao-mudar-posicao.sql no Supabase." };
    return { ok: false, message: actionError(error, "Não foi possível mudar a posição da OS.") ?? "" };
  }
  for (const path of ["/laboratorio", "/lentes", "/montagem", "/entrega", "/inicio", "/dashboard", "/pdv", `/laboratorio/${id}`]) revalidatePath(path);
  return { ok: true, message: `Movida para ${REPOSITION_LABEL[to]}.` };
}
