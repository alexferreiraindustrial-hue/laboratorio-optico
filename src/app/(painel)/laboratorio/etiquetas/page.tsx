"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LabelSheet, type LabelCard } from "@/components/label-sheet";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { LensSpec } from "@/lib/types";

type OrderLabel = {
  id: string;
  number: string;
  client_name: string;
  store_name: string | null;
  seller_name: string | null;
  laboratory_name: string | null;
  external_order_id: string | null;
  entered_at: string;
  due_at: string | null;
  service_description: string | null;
  lens_spec: LensSpec | null;
};

function eye(spec: LensSpec | null, side: "od" | "oe") {
  if (!spec) return "—";
  const sphere = spec[`${side}_sphere`] || "—";
  const cylinder = spec[`${side}_cylinder`] || "";
  const axis = spec[`${side}_axis`] || "—";
  return `${sphere} ${cylinder} eixo ${axis}`.replace(/\s+/g, " ").trim();
}

function OrderLabels() {
  const params = useSearchParams();
  const idList = params.get("ids") ?? "";
  const [cards, setCards] = useState<LabelCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ids = idList.split(",").filter(Boolean);
    if (ids.length === 0) return;
    const supabase = createClient();
    void supabase
      .from("orders_enriched")
      .select("id, number, client_name, store_name, seller_name, laboratory_name, external_order_id, entered_at, due_at, service_description, lens_spec")
      .in("id", ids)
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
          return;
        }
        setCards(((data ?? []) as OrderLabel[]).map((order) => ({
          id: order.id,
          href: `/laboratorio/${order.id}`,
          code: order.number,
          title: order.client_name,
          lines: [
            order.store_name || "Sem loja",
            order.seller_name ? `Vendedor ${order.seller_name}` : "Sem vendedor",
            order.laboratory_name || "",
            order.external_order_id ? `Pedido ${order.external_order_id}` : "",
            `Entrada ${formatDateTime(order.entered_at)}`,
            `Previsão ${formatDateTime(order.due_at)}`,
            order.service_description || "",
            `OD ${eye(order.lens_spec, "od")}`,
            `OE ${eye(order.lens_spec, "oe")}`,
            order.lens_spec?.addition ? `Adição ${order.lens_spec.addition}` : "",
            order.lens_spec?.frame ? `Armação ${order.lens_spec.frame}` : "",
          ].filter(Boolean),
        })));
      });
  }, [idList]);

  if (error) return <p className="text-sm text-[#b42318]">{error}</p>;
  return <LabelSheet cards={cards} empty="Selecione uma ordem para imprimir a etiqueta." />;
}

export default function OrderLabelsPage() {
  return (
    <Suspense>
      <OrderLabels />
    </Suspense>
  );
}
