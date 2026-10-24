import { PortalOrder } from "@/components/portal-view";
import { loadPortalDetail } from "@/server/portal";

export default async function StorePortalOrderPage({
  params,
}: {
  params: Promise<{ token: string; orderId: string }>;
}) {
  const { token, orderId } = await params;
  const { detail, error } = await loadPortalDetail(token, orderId);
  const title = detail?.store_name;
  return (
    <div>
      {title ? <p className="sr-only">{title}</p> : null}
      <PortalOrder kind="loja" token={token} detail={detail} error={error} />
    </div>
  );
}
