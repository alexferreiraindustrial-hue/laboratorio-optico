"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@/lib/domain/constants";
import { can } from "@/lib/domain/permissions";
import { systemNumberCandidates } from "@/lib/domain/quick-entry";
import { actionError, requireProfile } from "./session";

export type QuickCreateInput = {
  entries: {
    orderRef: string | null;
    clientName: string | null;
    /** Quando informados por linha, têm prioridade sobre os padrões abaixo. */
    sellerId?: string | null;
    storeId?: string | null;
    dueAt?: string | null;
    lensExpectedAt?: string | null;
    lensSupplierRef?: string | null;
  }[];
  laboratoryId: string;
  sellerId?: string | null;
  storeId?: string | null;
  dueHours: number | null;
  status: "aguardando_lentes" | "aguardando_montagem";
  priority: "normal" | "critica";
};

export type QuickCreateResult = {
  index: number;
  ok: boolean;
  id?: string;
  number?: string;
  message: string;
};

export async function quickCreateOrders(input: QuickCreateInput): Promise<{ ok: boolean; message?: string; results: QuickCreateResult[] }> {
  const { supabase, role } = await requireProfile();
  if (!can(role, "orders.write")) return { ok: false, message: "Seu perfil não abre OS.", results: [] };
  if (!input.laboratoryId) return { ok: false, message: "Selecione o laboratório.", results: [] };
  if (input.entries.length === 0) return { ok: false, message: "Nada para lançar.", results: [] };
  if (input.entries.length > 100) return { ok: false, message: "Lance no máximo 100 OS por vez.", results: [] };

  const now = new Date();
  const due = input.dueHours ? new Date(now.getTime() + input.dueHours * 36e5).toISOString() : null;
  const results: QuickCreateResult[] = [];

  for (const [index, entry] of input.entries.entries()) {
    const ref = entry.orderRef?.trim() || null;
    const name = entry.clientName?.trim() || (ref ? `OS ${ref}` : "");
    if (name.length < 2) {
      results.push({ index, ok: false, message: "Informe a OS ou o nome." });
      continue;
    }
    const hasOwnTarget = entry.sellerId !== undefined || entry.storeId !== undefined;
    const { data, error } = await supabase.rpc("create_service_order", {
      p_client_name: name,
      p_seller_id: (hasOwnTarget ? entry.sellerId : input.sellerId) || null,
      p_store_id: (hasOwnTarget ? entry.storeId : input.storeId) || null,
      p_laboratory_id: input.laboratoryId,
      p_entered_at: now.toISOString(),
      p_due_at: entry.dueAt !== undefined ? entry.dueAt : due,
      p_notes: entry.clientName ? "Lançamento rápido." : "Lançamento rápido só com o número da OS — completar o nome do cliente.",
      p_service_description: "Lançamento rápido",
      p_external_order_id: ref,
      p_priority: input.priority,
      p_status: input.status,
      p_lens_spec: {},
    });
    if (error) {
      results.push({ index, ok: false, message: actionError(error, "Não foi possível lançar.") ?? "Erro ao lançar." });
    } else {
      if (entry.lensExpectedAt || entry.lensSupplierRef) {
        await supabase
          .from("service_orders")
          .update({ lens_expected_at: entry.lensExpectedAt || null, lens_supplier_ref: entry.lensSupplierRef?.trim() || null })
          .eq("id", data.id as string);
      }
      results.push({ index, ok: true, id: data.id as string, number: data.number as string, message: `${data.number} aberta` });
    }
  }

  revalidatePath("/laboratorio");
  revalidatePath("/dashboard");
  const created = results.filter((item) => item.ok).length;
  return { ok: created > 0, message: `${created} de ${results.length} OS lançadas.`, results };
}

export type FoundOrder = {
  id: string;
  number: string;
  client_name: string;
  external_order_id: string | null;
  status: OrderStatus;
  seller_name: string | null;
  store_name: string | null;
  due_at: string | null;
};

/** Localiza OS pelo número do sistema, pelo número da ótica ou pelo nome. */
export async function findOrdersForQuick(query: string): Promise<{ ok: boolean; message?: string; orders: FoundOrder[] }> {
  const { supabase } = await requireProfile();
  const text = query.trim();
  if (text.length < 1) return { ok: false, message: "Digite ou leia o número da OS.", orders: [] };
  const fields = "id, number, client_name, external_order_id, status, seller_name, store_name, due_at";
  const safe = text.replace(/[%_,()"\\]/g, " ").replace(/\s+/g, " ").trim();
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(new Date()));

  const numbers = /^OS-/i.test(safe) ? [safe.toUpperCase()] : /^\d+$/.test(safe) ? systemNumberCandidates(safe, year) : [];
  const exact = await supabase
    .from("orders_enriched")
    .select(fields)
    .or([...numbers.map((n) => `number.eq."${n}"`), `external_order_id.eq."${safe}"`].join(","))
    .limit(5);
  if (exact.error) return { ok: false, message: exact.error.message, orders: [] };
  if ((exact.data ?? []).length > 0) return { ok: true, orders: exact.data as FoundOrder[] };

  if (safe.length >= 3) {
    const loose = await supabase
      .from("orders_enriched")
      .select(fields)
      .or(`client_name.ilike."%${safe}%",external_order_id.ilike."%${safe}%",number.ilike."%${safe}%"`)
      .not("status", "in", "(entregue,cancelado)")
      .order("entered_at", { ascending: false })
      .limit(8);
    if (loose.error) return { ok: false, message: loose.error.message, orders: [] };
    if ((loose.data ?? []).length > 0) return { ok: true, orders: loose.data as FoundOrder[] };
  }
  return { ok: false, message: `Nenhuma OS encontrada para “${text}”.`, orders: [] };
}

export async function quickMoveOrders(
  ids: string[],
  to: "aguardando_montagem" | "entregue",
  note: string,
): Promise<{ ok: boolean; message: string; results: { id: string; ok: boolean; message: string }[] }> {
  const { supabase, role } = await requireProfile();
  if (to === "entregue" && !can(role, "orders.deliver")) {
    return { ok: false, message: "Apenas gestor ou administrador registra a saída.", results: [] };
  }
  if (to === "aguardando_montagem" && !can(role, "orders.status")) {
    return { ok: false, message: "Seu perfil não movimenta OS.", results: [] };
  }
  const results: { id: string; ok: boolean; message: string }[] = [];
  for (const id of ids.slice(0, 100)) {
    const { error } = await supabase.rpc("change_order_status", { p_order_id: id, p_to: to, p_note: note });
    results.push({ id, ok: !error, message: error ? actionError(error, "Falhou.") ?? "Falhou." : "Feito" });
  }
  revalidatePath("/laboratorio");
  revalidatePath("/montagem");
  revalidatePath("/dashboard");
  const done = results.filter((item) => item.ok).length;
  return { ok: done > 0, message: `${done} de ${results.length} OS atualizadas.`, results };
}
