"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmClientDelivery } from "@/server/fast-operations-actions";
import { dateTimeLocalToIso } from "@/lib/domain/calendar";
import { toDateTimeLocalValue, formatDateTime } from "@/lib/format";
import type { ClientDelivery } from "@/lib/domain/client-followup";
import { Button, Feedback } from "./ui";
export function ClientDeliveryForm({
  id,
  status,
  delivery,
  defaultPhone = null,
}: {
  id: string;
  status: string;
  delivery?: ClientDelivery | null;
  defaultPhone?: string | null;
}) {
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [date, setDate] = useState(() =>
    toDateTimeLocalValue(new Date().toISOString()),
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!["pronto", "entregue"].includes(status)) return null;
  return (
    <section className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-semibold">Entrega efetiva ao cliente</h2>
      {delivery ? (
        <p className="mt-2 text-sm">
          Confirmada em {formatDateTime(delivery.client_delivered_at)}.
          Pós-venda a partir de {formatDateTime(delivery.followup_due_at)}.{" "}
          <Link href="/pos-venda" className="text-[var(--link)] underline">
            Ver acompanhamento
          </Link>
        </p>
      ) : (
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer text-sm text-[var(--link)]">
            Confirmar que o cliente recebeu os óculos
          </summary>
          <form
            className="mt-2 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              let delivered: string;
              try {
                delivered = dateTimeLocalToIso(date);
              } catch {
                setError("Confira a data real da entrega.");
                return;
              }
              start(async () => {
                setError(null);
                try {
                  const result = await confirmClientDelivery(
                    id,
                    phone,
                    delivered,
                  );
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  setMessage(result.message);
                  router.refresh();
                } catch {
                  setError(
                    "Não foi possível confirmar. Atualize antes de repetir.",
                  );
                }
              });
            }}
          >
            <p className="text-xs text-[var(--muted)]">
              Use somente após a entrega ao cliente. A saída para vendedor ou
              loja não inicia o prazo de cinco dias.
            </p>
            <label className="text-sm">
              Data e hora reais
              <input
                required
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3"
              />
            </label>
            <label className="text-sm">
              Telefone do cliente · pode completar depois
              <input
                type="tel"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={24}
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3"
              />
            </label>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Confirmando…"
                : "Confirmar entrega ao cliente e iniciar acompanhamento"}
            </Button>
          </form>
        </details>
      )}
      <Feedback error={error} message={message} />
    </section>
  );
}
