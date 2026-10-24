export type PortalAccess = {
  kind: "store" | "seller";
  storeId?: string | null;
  sellerId?: string | null;
};

export type PortalOrderRef = {
  storeId: string | null;
  sellerId: string | null;
};

export function canPortalSeeOrder(access: PortalAccess, order: PortalOrderRef) {
  if (access.kind === "store") {
    return Boolean(access.storeId && order.storeId === access.storeId);
  }
  return Boolean(access.sellerId && order.sellerId === access.sellerId);
}

export function sanitizeMessage(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

export function messageError(value: string) {
  const text = sanitizeMessage(value);
  if (text.length < 5 || text.length > 800) {
    return "Escreva uma mensagem entre 5 e 800 caracteres.";
  }
  return null;
}

export function sellersForStore<T extends { id: string }>(
  sellers: T[],
  links: { seller_id: string; store_id: string }[],
  storeId: string,
) {
  const allowed = new Set(links.filter((link) => link.store_id === storeId).map((link) => link.seller_id));
  return sellers.filter((seller) => allowed.has(seller.id));
}
