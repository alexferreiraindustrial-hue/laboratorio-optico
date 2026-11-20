import { PortalOrder, PortalDenied } from "@/components/portal-view";
import { loadPortalDetail } from "@/server/portal";
import { sellerSession } from "@/server/seller-session";

export default async function SellerOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const session = await sellerSession();
  if (session.error) return <PortalDenied message={session.error} />;
  const { orderId } = await params;
  const { detail, error } = await loadPortalDetail(session.token, orderId);
  return <PortalOrder kind="vendedor" token="" detail={detail} error={error} basePath="/vendedor" sessionAccess />;
}
