"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  feedbackMessage,
  feedbackPending,
  matchesFollowup,
  type ClientFollowupRow,
} from "@/lib/domain/client-followup";
import { formatDateTime } from "@/lib/format";
import { updateClientFollowup } from "@/server/fast-operations-actions";
import { findOrdersForQuick, type FoundOrder } from "@/server/quick-actions";
import { ClientDeliveryForm } from "./client-delivery";
import { Button, Feedback } from "./ui";
const field =
  "mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm";
function FollowupCard({ row, now }: { row: ClientFollowupRow; now: Date }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <article className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={`/laboratorio/${row.order_id}`}
            className="font-semibold text-[var(--link)]"
          >
            OS {row.number} · {row.client_name}
          </Link>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {row.seller_name || "Sem vendedora"} · cliente recebeu{" "}
            {formatDateTime(row.client_delivered_at)}
          </p>
          <p className="mt-1 text-xs">
            {feedbackPending(row, now)
              ? "Contato pendente desde"
              : "Acompanhamento a partir de"}{" "}
            {formatDateTime(row.followup_due_at)}
            {!row.client_phone ? " · falta telefone" : ""}
          </p>
        </div>
        <span className="text-xs font-semibold">
          {row.outcome || "Pendente"}
        </span>
      </div>
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer text-sm text-[var(--link)]">
          Mensagem, contato e retorno do cliente
        </summary>
        <p className="mt-2 rounded-lg bg-[var(--background)] p-3 text-sm">
          {feedbackMessage(row.client_name)}
        </p>
        <Button
          variant="secondary"
          disabled={!row.client_phone}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                feedbackMessage(row.client_name),
              );
              setMessage(
                "Mensagem copiada. O envio e a confirmação do contato são manuais.",
              );
            } catch {
              setError("Copie o texto acima manualmente.");
            }
          }}
        >
          Copiar mensagem · não marca como enviada
        </Button>
        <form
          className="mt-3 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) return;
            const form = new FormData(e.currentTarget);
            start(async () => {
              setError(null);
              try {
                const result = await updateClientFollowup(
                  row.id,
                  String(form.get("outcome") || "") || null,
                  String(form.get("note") || ""),
                  String(form.get("phone") || ""),
                  row.updated_at,
                );
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                setMessage(result.message);
                router.refresh();
              } catch {
                setError("Atualize a tela antes de tentar novamente.");
              }
            });
          }}
        >
          <label className="text-sm">
            Telefone
            <input
              name="phone"
              type="tel"
              defaultValue={row.client_phone ?? ""}
              maxLength={24}
              className={field}
            />
          </label>
          <label className="text-sm">
            Registro do contato
            <select name="outcome" defaultValue="" className={field}>
              <option value="">Apenas atualizar contato / observação</option>
              <option value="contato_realizado">
                Mensagem enviada · aguardando resposta
              </option>
              <option value="adaptacao_ok">
                Cliente respondeu · está tudo bem
              </option>
              <option value="precisa_ajuda">
                Cliente relatou dificuldade · precisa de atenção
              </option>
              <option value="sem_resposta">
                Contato realizado · ainda sem resposta
              </option>
            </select>
          </label>
          <label className="text-sm">
            O que o cliente informou?
            <textarea
              name="note"
              defaultValue={row.feedback_note ?? ""}
              maxLength={2000}
              rows={2}
              className={field}
            />
          </label>
          <Button disabled={pending} type="submit">
            {pending ? "Salvando…" : "Salvar acompanhamento"}
          </Button>
        </form>
      </details>
      <Feedback error={error} message={message} />
    </article>
  );
}
export function ClientFollowupPanel({
  rows,
  nowIso,
}: {
  rows: ClientFollowupRow[];
  nowIso: string;
}) {
  const [now] = useState(() => new Date(nowIso));
  const [seller, setSeller] = useState("");
  const [mode, setMode] = useState("pending");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<FoundOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const visible = rows.filter((r) => matchesFollowup(r, seller, mode, now));
  const sellers = [
    ...new Map(
      rows
        .filter((r) => r.seller_id)
        .map((r) => [r.seller_id!, r.seller_name || "Vendedora"]),
    ).entries(),
  ];
  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <h2 className="font-semibold">Dar baixa da entrega ao cliente</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Bipe ou informe a OS. Só esta confirmação inicia os cinco dias;
          entregas antigas não foram presumidas.
        </p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) return;
            start(async () => {
              setError(null);
              try {
                const result = await findOrdersForQuick(query);
                setFound(
                  result.orders.filter((o) =>
                    ["pronto", "entregue"].includes(o.status),
                  ),
                );
                if (!result.ok) setError(result.message || "Não encontrado.");
                else if (
                  !result.orders.some((o) =>
                    ["pronto", "entregue"].includes(o.status),
                  )
                )
                  setError(
                    "Este serviço ainda não está pronto ou não saiu do laboratório.",
                  );
              } catch {
                setError("Não foi possível consultar a OS.");
              }
            });
          }}
        >
          <input
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Número da OS"
            className={field}
          />
          <Button disabled={pending} type="submit">
            Localizar
          </Button>
        </form>
        {found.map((order) => (
          <div key={order.id} className="mt-2">
            <strong className="text-sm">
              {order.number} · {order.client_name}
            </strong>
            <ClientDeliveryForm
              id={order.id}
              status={order.status}
              delivery={rows.find((r) => r.order_id === order.id)}
            />
          </div>
        ))}
        <Feedback error={error} />
      </section>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Vendedora
          <select
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
            className={field}
          >
            <option value="">Todas</option>
            {sellers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Mostrar
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className={field}
          >
            <option value="pending">
              Prazo de cinco dias vencido · falta contato
            </option>
            <option value="await">Aguardando completar cinco dias</option>
            <option value="help">Cliente precisa de atenção</option>
            <option value="contacted">Contatos já registrados</option>
            <option value="all">Todos</option>
          </select>
        </label>
      </div>
      <p className="text-sm text-[var(--muted)]">
        {visible.length} acompanhamento(s). Sem telefone, complete o contato
        antes de copiar a mensagem.
      </p>
      {visible.map((row) => (
        <FollowupCard key={`${row.id}-${row.updated_at}`} row={row} now={now} />
      ))}
      {!visible.length && (
        <p className="rounded-lg border border-dashed border-[var(--line)] p-5 text-sm">
          Nenhum acompanhamento neste filtro.
        </p>
      )}
    </div>
  );
}
