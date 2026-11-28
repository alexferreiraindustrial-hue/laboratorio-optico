"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { notifyClientReady, saveClientPhone } from "@/server/contact-actions";
import { formatPhone, phoneDigits, validPhone } from "@/lib/domain/client-contact";
import { formatDateTime } from "@/lib/format";
import { Button } from "./ui";
import { ClientWhatsApp } from "./client-whatsapp";

export type ClientContactInfo = { phone: string | null; phoneEnabled: boolean; notifiedAt: string | null };

/** WhatsApp do cliente na OS e o botão de avisar que está pronto (envia pelo CRM). */
export function ClientContact({ id, status, contact, editable, compact = false, clientName = "" }: { id: string; status: string; contact: ClientContactInfo; editable: boolean; compact?: boolean; clientName?: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState(contact.phone ? formatPhone(contact.phone) : "");
  const [pending, start] = useTransition();
  if (!contact.phoneEnabled) return null;
  if (compact) {
    if (!contact.phone) {
      return status === "pronto" ? (
        <p className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--accent-soft)] p-3 text-sm">Óculos pronto. Para avisar o cliente pelo WhatsApp, coloque o número em <b>WhatsApp do cliente</b> logo abaixo e salve.</p>
      ) : null;
    }
    return (
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{status === "pronto" ? (contact.notifiedAt ? "Óculos pronto · cliente avisado" : "Óculos pronto · avisar o cliente") : "Falar com o cliente"}</p>
          <p className="text-xs text-[var(--muted)]">{formatPhone(contact.phone)}{contact.notifiedAt ? ` · avisado em ${formatDateTime(contact.notifiedAt)}` : ""}</p>
        </div>
        {editable ? <ClientWhatsApp orderId={id} client={clientName} phone={contact.phone} status={status} label={status === "pronto" && !contact.notifiedAt ? "Avisar pelo WhatsApp" : "WhatsApp"} /> : null}
      </div>
    );
  }
  const changed = phoneDigits(phone) !== phoneDigits(contact.phone);
  const ready = status === "pronto";

  function save() {
    start(async () => {
      const result = await saveClientPhone(id, phone);
      if (!result.ok) return void toast.error(result.message);
      toast.success(result.message ?? "Salvo.");
      router.refresh();
    });
  }
  function notify() {
    if (contact.notifiedAt && !window.confirm(`O cliente já foi avisado em ${formatDateTime(contact.notifiedAt)}. Avisar de novo?`)) return;
    start(async () => {
      const result = await notifyClientReady(id, phone);
      if (!result.ok) return void toast.error(result.message);
      toast.success(result.message ?? "Cliente avisado.");
      router.refresh();
    });
  }

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
      <label className="grid gap-1 text-sm font-medium">
        WhatsApp do cliente
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          inputMode="tel"
          placeholder="(12) 99999-9999"
          disabled={!editable || pending}
          className="min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-base"
        />
      </label>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          {changed ? <Button variant="secondary" disabled={pending || (!!phoneDigits(phone) && !validPhone(phone))} onClick={save}>Salvar telefone</Button> : null}
          {contact.phone && !changed ? <ClientWhatsApp orderId={id} client={clientName} phone={contact.phone} status={status} label={ready ? "Outra mensagem" : "Mandar WhatsApp"} /> : null}
          {ready ? (
            <Button disabled={pending || !validPhone(phone)} onClick={notify}>
              <MessageCircle size={17} aria-hidden />
              {contact.notifiedAt ? "Avisar de novo" : "Avisar cliente que está pronto"}
            </Button>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs text-[var(--muted)]">
        {contact.notifiedAt
          ? `Cliente avisado em ${formatDateTime(contact.notifiedAt)}.`
          : ready
            ? "A mensagem sai pelo WhatsApp da Goldfinger e fica registrada no CRM."
            : "O aviso de pronto aparece quando a OS estiver na gaveta. O telefone também vai para o pós-venda."}
      </p>
    </div>
  );
}
