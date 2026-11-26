"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OrderLabelPicker, OrderLabelPrint } from "@/components/order-labels";

function OrderLabels() {
  const params = useSearchParams();
  const ids = (params.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  return ids.length ? <OrderLabelPrint ids={ids} /> : <OrderLabelPicker />;
}

export default function OrderLabelsPage() {
  return (
    <Suspense>
      <OrderLabels />
    </Suspense>
  );
}
