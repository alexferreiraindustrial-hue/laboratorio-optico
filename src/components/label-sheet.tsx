"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

export type LabelCard = {
  id: string;
  href: string;
  code: string;
  title: string;
  lines: string[];
};

export function LabelSheet({ cards, empty }: { cards: LabelCard[]; empty: string }) {
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (cards.length === 0) return;
    let active = true;
    void import("qrcode").then(async (QRCode) => {
      const next: Record<string, string> = {};
      for (const card of cards) {
        next[card.id] = await QRCode.toDataURL(`${window.location.origin}${card.href}`, {
          margin: 0,
          width: 180,
        });
      }
      if (active) setImages(next);
    });
    return () => {
      active = false;
    };
  }, [cards]);

  if (cards.length === 0) return <p className="text-sm">{empty}</p>;

  return (
    <div>
      <div className="no-print mb-4">
        <Button type="button" onClick={() => window.print()}>Imprimir ou salvar PDF</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <article key={card.id} className="label-ticket flex gap-3 rounded border border-[#e2e7e9] bg-white p-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-base font-semibold">{card.code}</p>
              <p className="text-sm font-medium">{card.title}</p>
              {card.lines.map((line) => (
                <p key={line} className="text-xs text-[#44524f]">{line}</p>
              ))}
            </div>
            {images[card.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[card.id]} alt="" className="h-24 w-24 shrink-0" />
            ) : (
              <p className="w-24 text-xs text-[#6e7c7a]">Gerando QR...</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
