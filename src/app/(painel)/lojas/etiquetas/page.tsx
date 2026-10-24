"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LabelSheet, type LabelCard } from "@/components/label-sheet";
import { createClient } from "@/lib/supabase/client";

type StoreLabel = {
  id: string;
  public_code: string;
  trade_name: string;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
};

function StoreLabels() {
  const params = useSearchParams();
  const idList = params.get("ids") ?? "";
  const [cards, setCards] = useState<LabelCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ids = idList.split(",").filter(Boolean);
    if (ids.length === 0) return;
    const supabase = createClient();
    void supabase
      .from("stores")
      .select("id, public_code, trade_name, contact_name, phone, whatsapp")
      .in("id", ids)
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
          return;
        }
        setCards(((data ?? []) as StoreLabel[]).map((store) => ({
          id: store.id,
          href: `/lojas/${store.id}`,
          code: store.public_code,
          title: store.trade_name,
          lines: [
            store.contact_name ? `Responsável ${store.contact_name}` : "",
            store.phone ? `Telefone ${store.phone}` : "",
            store.whatsapp ? `WhatsApp ${store.whatsapp}` : "",
          ].filter(Boolean),
        })));
      });
  }, [idList]);

  if (error) return <p className="text-sm text-[#b42318]">{error}</p>;
  return <LabelSheet cards={cards} empty="Selecione uma loja para imprimir a etiqueta." />;
}

export default function StoreLabelsPage() {
  return (
    <Suspense>
      <StoreLabels />
    </Suspense>
  );
}
