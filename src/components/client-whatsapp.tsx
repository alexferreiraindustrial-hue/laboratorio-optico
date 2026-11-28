"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { sendClientMessage } from "@/server/contact-actions";
import { clientTemplates, formatPhone, waMeLink } from "@/lib/domain/client-contact";
import { cn } from "@/lib/utils";

/** Botão de WhatsApp do cliente: escolhe um modelo, ajusta o texto e envia pelo número da Goldfinger. */
export function ClientWhatsApp({ orderId, client, phone, status, label, className }: { orderId: string; client: string; phone: string | null | undefined; status: string; label?: string; className?: string }) {
  const router = useRouter();
  const templates = clientTemplates(client, status);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(templates[0].key);
  const [text, setText] = useState(templates[0].text);
  const [pending, start] = useTransition();
  if (!phone) return null;

  function choose(key: string) {
    const item = templates.find((template) => template.key === key);
    if (!item) return;
    setKind(key);
    setText(item.text);
  }
  function send() {
    start(async () => {
      const result = await sendClientMessage(orderId, text, kind);
      if (!result.ok) return void toast.error(result.message);
      toast.success(result.message ?? "Mensagem enviada.");
      setOpen(false);
      router.refresh();
    });
  }
  const link = waMeLink(phone, text);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) choose(templates[0].key); }}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={`WhatsApp de ${client}`}
          title={`WhatsApp de ${client} · ${formatPhone(phone)}`}
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-2.5 text-sm font-semibold text-white hover:bg-[#1ebe5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]",
            label ? "min-h-11 px-3" : "w-9 px-0",
            className,
          )}
        >
          <MessageCircle size={label ? 17 : 16} aria-hidden />
          {label ? <span>{label}</span> : null}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--solid-ink)]/35 backdrop-blur-[2px]" />
        <Dialog.Content onClick={(event) => event.stopPropagation()} className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-3 rounded-2xl bg-[var(--surface)] p-5 shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">{client}</Dialog.Title>
              <Dialog.Description className="text-[13px] text-[var(--muted)]">WhatsApp {formatPhone(phone)} · sai pelo número da Goldfinger</Dialog.Description>
            </div>
            <Dialog.Close className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--background)]" aria-label="Fechar"><X size={18} /></Dialog.Close>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Modelo de mensagem">
            {templates.map((template) => (
              <button key={template.key} type="button" aria-pressed={kind === template.key} onClick={() => choose(template.key)} className={cn("min-h-9 rounded-full border px-3 text-[13px] font-semibold", kind === template.key ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)] text-[var(--muted)]")}>
                {template.label}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-sm font-medium">
            Mensagem
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} maxLength={2000} className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-3 text-[15px] leading-relaxed" />
          </label>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {link ? <a href={link} target="_blank" rel="noreferrer" className="min-h-11 rounded-lg border border-[var(--line)] px-3 py-2.5 text-sm font-semibold text-[var(--link)]">Abrir no meu WhatsApp</a> : null}
            <button type="button" disabled={pending || text.trim().length < 5} onClick={send} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-semibold text-white disabled:opacity-60">
              <Send size={16} aria-hidden />{pending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
