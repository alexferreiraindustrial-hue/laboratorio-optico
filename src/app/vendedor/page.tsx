import { PortalHome, PortalDenied } from "@/components/portal-view";
import { loadPortalOrders } from "@/server/portal";
import { sellerSession } from "@/server/seller-session";

export default async function SellerHomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await sellerSession();
  if (session.error) return <PortalDenied message={session.error} />;
  const filters = await searchParams;
  const { orders, error } = await loadPortalOrders(session.token, { ...filters, seller: undefined });
  return <PortalHome title={session.name} kind="vendedor" token="" orders={orders} sellers={[]} filters={filters} error={error} basePath="/vendedor" sessionAccess />;
}
