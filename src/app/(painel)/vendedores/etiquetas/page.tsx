"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LabelSheet, type LabelCard } from "@/components/label-sheet";
import { createClient } from "@/lib/supabase/client";

type SellerLabel = {
  id: string;
  public_code: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
};

function SellerLabels() {
  const params = useSearchParams();
  const idList = params.get("ids") ?? "";
  const [cards, setCards] = useState<LabelCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ids = idList.split(",").filter(Boolean);
    if (ids.length === 0) return;
    const supabase = createClient();
    void supabase
      .from("sellers")
      .select("id, public_code, name, phone, whatsapp")
      .in("id", ids)
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
          return;
        }
        setCards(((data ?? []) as SellerLabel[]).map((seller) => ({
          id: seller.id,
          href: `/vendedores/${seller.id}`,
          code: seller.public_code,
          title: seller.name,
          lines: [
            seller.phone ? `Telefone ${seller.phone}` : "",
            seller.whatsapp ? `WhatsApp ${seller.whatsapp}` : "",
          ].filter(Boolean),
        })));
      });
  }, [idList]);

  if (error) return <p className="text-sm text-[#b42318]">{error}</p>;
  return <LabelSheet cards={cards} empty="Selecione um vendedor para imprimir a etiqueta." />;
}

export default function SellerLabelsPage() {
  return (
    <Suspense>
      <SellerLabels />
    </Suspense>
  );
}
