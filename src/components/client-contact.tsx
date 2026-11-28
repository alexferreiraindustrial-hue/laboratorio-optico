"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { notifyClientReady, saveClientPhone } from "@/server/contact-actions";
import { formatPhone, phoneDigits, validPhone } from "@/lib/domain/client-contact";
import { formatDateTime } from "@/lib/format";
import { Button } from "./ui";

export type ClientContactInfo = { phone: string | null; phoneEnabled: boolean; notifiedAt: string | null };

/** WhatsApp do cliente na OS e o botão de avisar que está pronto (envia pelo CRM). */
export function ClientContact({ id, status, contact, editable, compact = false }: { id: string; status: string; contact: ClientContactInfo; editable: boolean; compact?: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState(contact.phone ? formatPhone(contact.phone) : "");
  const [pending, start] = useTransition();
  if (!contact.phoneEnabled) return null;
  if (compact && status !== "pronto") return null;
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
      {compact ? <p className="text-sm font-semibold">Óculos pronto · avisar o cliente{contact.phone ? ` (${formatPhone(contact.phone)})` : ""}</p> : null}
      <label className={compact ? "hidden" : "grid gap-1 text-sm font-medium"}>
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
          : compact && !validPhone(phone)
            ? "Coloque o WhatsApp do cliente nos dados da OS abaixo e salve para poder avisar."
            : ready
            ? "A mensagem sai pelo WhatsApp da Goldfinger e fica registrada no CRM."
            : "O aviso de pronto aparece quando a OS estiver na gaveta. O telefone também vai para o pós-venda."}
      </p>
    </div>
  );
}
