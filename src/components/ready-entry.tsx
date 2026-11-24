"use client";
import Link from "next/link";
import { useState, useTransition, useRef } from "react";
import { createReadyOrder } from "@/server/fast-operations-actions";
import { dateTimeLocalToIso } from "@/lib/domain/calendar";
import { toDateTimeLocalValue } from "@/lib/format";
import { Button, Feedback } from "./ui";
export function ReadyEntry({
  sellers,
}: {
  sellers: { id: string; name: string; active: boolean }[];
}) {
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id?: string; message: string } | null>(
    null,
  );
  const [date, setDate] = useState(() =>
    toDateTimeLocalValue(new Date().toISOString()),
  );
  const field =
    "mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm";
  return (
    <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--link)]">
        Já está pronto? Registrar passagem pelo laboratório
      </summary>
      {saved ? (
        <div role="status" className="grid gap-2 p-4">
          <p>{saved.message}</p>
          <Link
            href={`/laboratorio/${saved.id}`}
            className="text-sm text-[var(--link)] underline"
          >
            Abrir registro · decidir médico ou entrega
          </Link>
          <Button variant="secondary" onClick={() => setSaved(null)}>
            Registrar outro já pronto
          </Button>
        </div>
      ) : (
        <form
          className="grid gap-3 border-t border-[var(--line)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy.current) return;
            const data = new FormData(e.currentTarget);
            let completedAt: string;
            try {
              completedAt = dateTimeLocalToIso(date);
            } catch {
              setError("Confira quando ficou pronto.");
              return;
            }
            busy.current = true;
            start(async () => {
              setError(null);
              try {
                const result = await createReadyOrder({
                  sellerId: String(data.get("seller") || ""),
                  storeId: "",
                  orderRef: String(data.get("ref") || ""),
                  clientName: String(data.get("name") || ""),
                  completedAt,
                });
                if (result.ok) setSaved(result);
                else setError(result.message);
              } catch {
                setError(
                  "Não foi possível confirmar. Consulte a lista antes de repetir.",
                );
              } finally {
                busy.current = false;
              }
            });
          }}
        >
          <p className="text-xs text-[var(--muted)]">
            Cria um novo registro pronto, sem exigir etapas e sem marcar
            atividades que não foram registradas. Informe OS ou cliente.
          </p>
          <label className="text-sm">
            Vendedora
            <select required name="seller" className={field}>
              <option value="">Selecione</option>
              {sellers
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Número da OS · se tiver
              <input name="ref" maxLength={80} className={field} />
            </label>
            <label className="text-sm">
              Cliente · se não tiver OS
              <input name="name" maxLength={200} className={field} />
            </label>
          </div>
          <label className="text-sm">
            Quando ficou pronto
            <input
              required
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={field}
            />
          </label>
          <Button disabled={pending} type="submit">
            {pending ? "Registrando…" : "Registrar serviço já pronto"}
          </Button>
          <Feedback error={error} />
        </form>
      )}
    </details>
  );
}
