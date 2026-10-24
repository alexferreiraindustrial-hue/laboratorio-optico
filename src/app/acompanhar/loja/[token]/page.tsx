import { PortalHome } from "@/components/portal-view";
import { loadPortalIdentity, loadPortalOrders, loadPortalSellers } from "@/server/portal";

export default async function StorePortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const filters = await searchParams;
  const [{ orders, error }, sellers, identity] = await Promise.all([
    loadPortalOrders(token, filters),
    loadPortalSellers(token),
    loadPortalIdentity(token),
  ]);
  const title = identity.name;
  return <PortalHome title={title} kind="loja" token={token} orders={orders} sellers={sellers} filters={filters} error={error ?? identity.error} />;
}
