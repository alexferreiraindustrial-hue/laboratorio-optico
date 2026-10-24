import { PortalOrder } from "@/components/portal-view";
import { loadPortalDetail } from "@/server/portal";

export default async function SellerPortalOrderPage({
  params,
}: {
  params: Promise<{ token: string; orderId: string }>;
}) {
  const { token, orderId } = await params;
  const { detail, error } = await loadPortalDetail(token, orderId);
  return <PortalOrder kind="vendedor" token={token} detail={detail} error={error} />;
}
