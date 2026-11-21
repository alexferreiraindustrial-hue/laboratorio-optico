"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, ClipboardList, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

/** The URL owns selection, so back, refresh and copied links preserve the queue. */
export function OrderDrawer({ title, closeHref, detailHref, editor, workspace, description = "Complemente os dados sem perder sua posição na fila." }: {
  title: string;
  closeHref: string;
  detailHref: string;
  editor?: ReactNode;
  description?: string;
  workspace: ReactNode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(editor ? "dados" : "historico");
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) router.replace(closeHref, { scroll: false }); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--bg-102e34)]/35 backdrop-blur-[2px]" />
        <Dialog.Content className="lab-drawer fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--line)] bg-[var(--background)] shadow-2xl outline-none sm:max-w-[760px]">
          <header className="flex items-start gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-5 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--link)]"><ClipboardList size={20} /></span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-lg font-bold">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-[var(--muted)]">{description}</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Fechar ordem de serviço" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-[var(--background)]"><X size={20} /></Dialog.Close>
          </header>
          <div className="flex items-center gap-1 border-b border-[var(--line)] bg-[var(--surface)] px-5" role="tablist" aria-label="Conteúdo da OS" onKeyDown={(event) => {
            if (!editor || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? "dados" : event.key === "End" ? "historico" : tab === "dados" ? "historico" : "dados";
            setTab(next);
            document.getElementById(`os-tab-${next}`)?.focus();
          }}>
            {[["dados", "Editar dados"], ["historico", "Produção e histórico"]].filter(([key]) => key !== "dados" || editor).map(([key, label]) => (
              <button key={key} id={`os-tab-${key}`} role="tab" tabIndex={tab === key ? 0 : -1} aria-selected={tab === key} aria-controls={`os-panel-${key}`} type="button" onClick={() => setTab(key)} className={`min-h-12 border-b-2 px-3 text-sm font-semibold ${tab === key ? "border-[var(--accent)] text-[var(--link)]" : "border-transparent text-[var(--muted)]"}`}>{label}</button>
            ))}
            <Link href={detailHref} className="ml-auto flex min-h-11 items-center gap-1 text-xs font-semibold text-[var(--link)]"><span className="hidden sm:inline">Página completa</span><ArrowUpRight size={16} /></Link>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
            {editor ? <div role="tabpanel" id="os-panel-dados" aria-labelledby="os-tab-dados" hidden={tab !== "dados"} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">{editor}</div> : null}
            <div role="tabpanel" id="os-panel-historico" aria-labelledby="os-tab-historico" hidden={tab !== "historico"}>{workspace}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
