"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { Barcode } from "./barcode";

export function QrCard({ code }: { code: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [target, setTarget] = useState(code);

  useEffect(() => {
    let active = true;
    const url = `${window.location.origin}/estoque/codigo/${code}`;
    void import("qrcode").then((QRCode) => {
      void QRCode.toDataURL(url, { margin: 1, width: 220 }).then((value) => {
        if (!active) return;
        setTarget(url);
        setSrc(value);
      });
    });
    return () => {
      active = false;
    };
  }, [code]);

  return (
    <Panel className="p-4">
      <h2 className="font-medium">Etiqueta</h2>
      <p className="mt-1 break-all font-mono text-xs">{target}</p>
      {src ? (
        // QR gerado no navegador, em data URL. O otimizador de imagens não se aplica.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`QR Code ${code}`} className="mt-3 h-52 w-52" />
      ) : (
        <p className="mt-3 text-sm">Gerando QR Code...</p>
      )}
      <p className="mt-3 text-xs font-semibold text-[var(--muted)]">Código de barras (leitor)</p>
      <Barcode value={code} height={40} module={2} className="mt-1" />
    </Panel>
  );
}
