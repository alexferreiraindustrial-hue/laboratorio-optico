import type { OrderRow } from "@/lib/types";

const STORE_PALETTE = ["#1A6B5C", "#2F7DFF", "#7B4DFF", "#C45C26", "#0E7A8B", "#B23A6B"];
const SELLER_PALETTE = ["#D97706", "#DB2777", "#4F46E5", "#0D9488", "#7C3AED", "#EA580C"];

function hashColor(key: string, palette: string[]) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = ((hash * 31) + key.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function storeColor(name: string) {
  return hashColor(name || "Sem loja", STORE_PALETTE);
}

export function sellerColor(name: string) {
  return hashColor(name || "Sem vendedora", SELLER_PALETTE);
}

export function storeNameOf(order: OrderRow) {
  return order.store_name?.trim() || "Sem loja";
}

export function sellerNameOf(order: OrderRow) {
  return order.seller_name?.trim() || "Sem vendedora";
}

export function groupByStoreThenSeller(orders: OrderRow[]) {
  const stores: string[] = [];
  const byStore = new Map<string, OrderRow[]>();
  for (const order of orders) {
    const store = storeNameOf(order);
    if (!byStore.has(store)) {
      stores.push(store);
      byStore.set(store, []);
    }
    byStore.get(store)!.push(order);
  }
  return stores.map((store) => {
    const sellers: string[] = [];
    const bySeller = new Map<string, OrderRow[]>();
    for (const order of byStore.get(store) ?? []) {
      const seller = sellerNameOf(order);
      if (!bySeller.has(seller)) {
        sellers.push(seller);
        bySeller.set(seller, []);
      }
      bySeller.get(seller)!.push(order);
    }
    return { store, sellers: sellers.map((seller) => ({ seller, orders: bySeller.get(seller) ?? [] })) };
  });
}
