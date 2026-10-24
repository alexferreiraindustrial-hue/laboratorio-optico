"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Feedback, Input, Panel } from "@/components/ui";
import { resolveQrScan } from "@/lib/domain/qr";

export function QrScanner() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [cameraState, setCameraState] = useState("Iniciando câmera...");

  useEffect(() => {
    let scanner: { stop: () => Promise<void> } | null = null;
    let active = true;
    void (async () => {
      try {
        if (!window.isSecureContext) {
          setCameraState("A câmera exige HTTPS ou localhost. Use a busca manual.");
          return;
        }
        const { Html5Qrcode } = await import("html5-qrcode");
        const instance = new Html5Qrcode("qr-reader");
        scanner = instance;
        await instance.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: 220 },
          (text) => {
            const result = resolveQrScan(text);
            if (result.status === "identified") router.push(`/estoque/codigo/${result.code}`);
            else setError(result.message);
          },
          () => undefined,
        );
        if (active) setCameraState("Aponte a câmera para a etiqueta.");
      } catch {
        if (active) setCameraState("Não foi possível usar a câmera. Verifique a permissão ou pesquise pelo código.");
      }
    })();
    return () => {
      active = false;
      void scanner?.stop().catch(() => undefined);
    };
  }, [router]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="p-4">
        <h2 className="font-medium">Câmera</h2>
        <p className="mt-1 text-sm text-[#6e7c7a]">{cameraState}</p>
        <div id="qr-reader" className="mt-3 overflow-hidden rounded-md" />
        <Feedback error={error} />
      </Panel>
      <Panel className="p-4">
        <h2 className="font-medium">Pesquisa manual</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const result = resolveQrScan(manual);
            if (result.status !== "identified") {
              setError(result.message);
              return;
            }
            router.push(`/estoque/codigo/${result.code}`);
          }}
        >
          <Input value={manual} onChange={(event) => setManual(event.target.value)} placeholder="LN-XXXXXXXXXX" />
          <Button type="submit">Consultar</Button>
        </form>
      </Panel>
    </div>
  );
}
