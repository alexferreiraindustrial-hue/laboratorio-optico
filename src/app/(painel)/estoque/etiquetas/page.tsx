"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { formatDiopter } from "@/lib/format";
import type { StockRow } from "@/lib/types";

function Labels() {
  const params = useSearchParams();
  const idList = params.get("ids") ?? "";
  const ids = idList.split(",").filter(Boolean);
  const [items, setItems] = useState<Array<StockRow & { src: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const selected = idList.split(",").filter(Boolean);
    if (selected.length === 0) return;
    const supabase = createClient();
    void supabase
      .from("lens_prescription_stock")
      .select("*")
      .in("id", selected)
      .then(async ({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
          return;
        }
        const QRCode = await import("qrcode");
        const next = await Promise.all(
          ((data ?? []) as StockRow[]).map(async (item) => ({
            ...item,
            src: await QRCode.toDataURL(`${window.location.origin}/estoque/codigo/${item.public_code}`, { margin: 0, width: 160 }),
          })),
        );
        setItems(next);
      });
  }, [idList]);

  if (ids.length === 0) return <p className="text-sm">Selecione um item de estoque para imprimir a etiqueta.</p>;

  return (
    <div>
      <div className="no-print mb-4">
        <Button type="button" onClick={() => window.print()}>Imprimir ou salvar PDF</Button>
        {error ? <p className="mt-2 text-sm text-[#b42318]">{error}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="rounded border border-[#e2e7e9] bg-white p-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.src} alt="" className="mx-auto h-28 w-28" />
            <p className="mt-2 font-mono text-sm">{item.public_code}</p>
            <p className="text-sm">{formatDiopter(item.sphere_cents)} / {formatDiopter(item.cylinder_cents)}</p>
            <p className="text-xs text-[#6e7c7a]">{item.location || "Sem localização"}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function LabelsPage() {
  return (
    <Suspense>
      <Labels />
    </Suspense>
  );
}
