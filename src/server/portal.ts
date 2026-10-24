import { createHash } from "crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type PortalOrder = {
  id: string;
  number: string;
  client_name: string;
  external_order_id: string | null;
  seller_name: string | null;
  store_name: string | null;
  entered_at: string;
  due_at: string | null;
  status: string;
  late: boolean;
  priority?: string | null;
};

export type PortalDetail = {
  id: string;
  number: string;
  client_name: string;
  external_order_id: string | null;
  seller_name: string | null;
  store_name: string | null;
  entered_at: string;
  due_at: string | null;
  status: string;
  service_description: string;
  late: boolean;
  history: { from_status: string | null; to_status: string; created_at: string }[];
  messages: {
    id: string;
    sender_kind: string;
    sender_label: string;
    body: string;
    status: string;
    created_at: string;
    reply_body: string | null;
    replied_at: string | null;
  }[];
};

async function ipHash() {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "local";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function portalContextError(error: { message: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("revogado")) return "Este link foi revogado.";
  if (message.includes("Muitas tentativas")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (message.includes("inválido") || message.includes("não encontrada")) return message;
  return "Não foi possível consultar o acompanhamento.";
}

export async function loadPortalOrders(
  token: string,
  filters: {
    q?: string;
    seller?: string;
    status?: string;
    from?: string;
    to?: string;
    late?: string;
    ready?: string;
  },
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_orders", {
    p_token: token,
    p_ip_hash: await ipHash(),
    p_query: filters.q ?? "",
    p_seller_id: filters.seller || null,
    p_status: filters.status ?? "",
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_late: filters.late === "1",
    p_ready: filters.ready === "1",
  });
  return {
    orders: (data ?? []) as PortalOrder[],
    error: error ? await portalContextError(error) : null,
  };
}

export async function loadPortalIdentity(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_identity", {
    p_token: token,
    p_ip_hash: await ipHash(),
  });
  const row = (data ?? null) as { name?: string } | null;
  return { name: row?.name ?? "Acompanhamento", error: error ? await portalContextError(error) : null };
}

export async function loadPortalSellers(token: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_sellers", {
    p_token: token,
    p_ip_hash: await ipHash(),
  });
  return (data ?? []) as { id: string; name: string }[];
}

export async function loadPortalDetail(token: string, orderId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_order_detail", {
    p_token: token,
    p_ip_hash: await ipHash(),
    p_order_id: orderId,
  });
  return {
    detail: (data ?? null) as PortalDetail | null,
    error: error ? await portalContextError(error) : null,
  };
}

export async function sendPortalMessage(token: string, orderId: string, body: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_send_message", {
    p_token: token,
    p_ip_hash: await ipHash(),
    p_order_id: orderId,
    p_body: body,
  });
  if (error) return { ok: false as const, message: await portalContextError(error) };
  return { ok: true as const, message: "Recado enviado ao laboratório." };
}
