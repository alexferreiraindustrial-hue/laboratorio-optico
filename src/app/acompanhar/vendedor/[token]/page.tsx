import { PortalHome } from "@/components/portal-view";
import { loadPortalIdentity, loadPortalOrders } from "@/server/portal";

export default async function SellerPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const filters = await searchParams;
  const [{ orders, error }, identity] = await Promise.all([
    loadPortalOrders(token, filters),
    loadPortalIdentity(token),
  ]);
  const title = identity.error ? "Acompanhamento" : identity.name;
  return <PortalHome title={title} kind="vendedor" token={token} orders={orders} sellers={[]} filters={filters} error={error} />;
}
