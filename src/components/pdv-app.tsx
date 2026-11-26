"use client";
// PDV da produção: tela própria, sem o menu do sistema. Três áreas num lugar só:
// bipar (caixa), lançar OS e acompanhar os prazos. Tudo usa as ações que o sistema já tinha.
import { Expand, LogOut, Plus, ScanBarcode, Shrink } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ROLE_LABEL, type AppRole } from "@/lib/domain/constants";
import { can } from "@/lib/domain/permissions";
import type { Laboratory, Seller, SellerStoreLink, Store } from "@/lib/types";
import { LabelQueueChip } from "./label-queue-chip";
import { GlobalOrderMenu } from "./order-context-menu";
import { QuickLaunch } from "./quick-launch";
import { ReadyEntry } from "./ready-entry";
import { ScanStation } from "./scan-station";

type Area = "bipar" | "lancar";

export function PdvApp({ role, name, orgName, laboratories, sellers, stores, sellerLinks }: {
  role: AppRole; name: string; orgName: string; laboratories: Laboratory[]; sellers: Seller[]; stores: Store[]; sellerLinks: SellerStoreLink[];
}) {
  const [area, setArea] = useState<Area>("bipar");
  const [full, setFull] = useState(false);
  const [clock, setClock] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const canLaunch = can(role, "orders.write") || can(role, "orders.status") || can(role, "orders.deliver");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const timer = window.setInterval(tick, 15_000);
    const keys = (event: KeyboardEvent) => {
      if (event.key === "F9") { event.preventDefault(); setArea("bipar"); }
      if (event.key === "F10" && canLaunch) { event.preventDefault(); setArea("lancar"); }
    };
    const onFull = () => setFull(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", keys);
    document.addEventListener("fullscreenchange", onFull);
    return () => { window.clearInterval(timer); window.removeEventListener("keydown", keys); document.removeEventListener("fullscreenchange", onFull); };
  }, [canLaunch]);

  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch { /* navegador sem tela cheia */ }
  }

  return (
    <div ref={root} className="pdv-app">
      <header className="pdv-bar">
        <Link href="/dashboard" className="pdv-brand" title="Voltar ao sistema">
          <ScanBarcode size={22} aria-hidden />
          <span><b>PDV da produção</b><small>{orgName}</small></span>
        </Link>
        <nav className="pdv-areas" aria-label="Áreas do PDV">
          <button type="button" aria-pressed={area === "bipar"} onClick={() => setArea("bipar")}><ScanBarcode size={17} />Bipar<kbd>F9</kbd></button>
          {canLaunch ? <button type="button" aria-pressed={area === "lancar"} onClick={() => setArea("lancar")}><Plus size={17} />Lançar OS<kbd>F10</kbd></button> : null}
        </nav>
        <div className="pdv-bar-end">
          <time className="pdv-clock">{clock}</time>
          <span className="pdv-user"><b>{name}</b><small>{ROLE_LABEL[role]}</small></span>
          <button type="button" className="pdv-bar-btn" onClick={toggleFull}>{full ? <Shrink size={16} /> : <Expand size={16} />}<span>{full ? "Sair da tela cheia" : "Tela cheia"}</span></button>
          <Link href="/dashboard" className="pdv-bar-btn"><LogOut size={16} /><span>Sair do PDV</span></Link>
        </div>
      </header>

      <main className="pdv-body">
        {/* O caixa continua montado ao trocar de área, para não perder o cupom do turno. */}
        <div hidden={area !== "bipar"}><ScanStation role={role} embedded /></div>
        {canLaunch ? (
          <div hidden={area !== "lancar"} className="pdv-launch">
            <div className="pdv-launch-head">
              <h1>Lançar OS</h1>
              <p>Entrada de serviço, chegada de lentes ou saída. Depois de salvar, imprima a etiqueta com código de barras e bipe no caixa.</p>
            </div>
            {can(role, "orders.write") ? <ReadyEntry sellers={sellers} /> : null}
            <QuickLaunch role={role} laboratories={laboratories} sellers={sellers} stores={stores} sellerLinks={sellerLinks} initialMode={can(role, "orders.write") ? "entrada" : "lentes"} />
          </div>
        ) : null}
      </main>
      <GlobalOrderMenu role={role} />
      <LabelQueueChip />
    </div>
  );
}
