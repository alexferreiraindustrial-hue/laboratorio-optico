import { OrderWorkspace } from "@/components/order-workspace";
import { loadOrderDetail } from "@/server/order-detail";

export default async function AssemblyOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadOrderDetail(id);
  return <OrderWorkspace {...detail} mode="montagem" />;
}
