"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatDateTime } from "@/lib/format";
import { replyMessage } from "@/server/parties";
import { Button, Feedback, Panel, Select } from "./ui";

export type InboxItem = {
  id: string;
  order_id: string;
  sender_label: string;
  body: string;
  status: string;
  created_at: string;
  reply_body: string | null;
  order_number?: string;
  store_name?: string | null;
  seller_name?: string | null;
};

export function Inbox({
  items,
  filters,
}: {
  items: InboxItem[];
  filters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [router]);
  return (
    <div className="grid gap-3">
      <Panel className="p-3">
        <form className="grid gap-2 md:grid-cols-5">
          <input name="q" defaultValue={filters.q} placeholder="OS ou trecho" className="h-9 rounded-md border border-[#cdd5d8] px-3 text-sm" />
          <Select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todas</option>
            <option value="novo">Novas</option>
            <option value="visualizado">Visualizadas</option>
            <option value="respondido">Respondidas</option>
          </Select>
          <input name="from" type="date" defaultValue={filters.from} aria-label="De" className="h-9 rounded-md border border-[#cdd5d8] px-3 text-sm" />
          <input name="to" type="date" defaultValue={filters.to} aria-label="Até" className="h-9 rounded-md border border-[#cdd5d8] px-3 text-sm" />
          <Button type="submit">Filtrar</Button>
        </form>
      </Panel>
      {items.length === 0 ? <p className="text-sm text-[#6e7c7a]">Nenhum recado neste filtro.</p> : null}
      {items.map((item) => <MessageCard key={item.id} item={item} />)}
    </div>
  );
}

function MessageCard({ item }: { item: InboxItem }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Panel className="p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{item.sender_label}</p>
        <span className="text-xs uppercase text-[#6e7c7a]">{item.status}</span>
      </div>
      <p className="mt-1 text-xs text-[#6e7c7a]">
        {item.store_name || "Sem loja"}{item.seller_name ? ` · ${item.seller_name}` : ""} · {formatDateTime(item.created_at)}
      </p>
      <p className="mt-2 whitespace-pre-wrap">{item.body}</p>
      <p className="mt-2"><Link className="text-[#0e6b62]" href={`/laboratorio/${item.order_id}`}>{item.order_number || "Abrir OS"}</Link></p>
      {item.reply_body ? <p className="mt-2 border-t border-[#e2e7e9] pt-2 whitespace-pre-wrap">Resposta: {item.reply_body}</p> : (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await replyMessage(formData);
              if (!result.ok) setError(result.message);
              else router.refresh();
            });
          }}
        >
          <input type="hidden" name="id" value={item.id} />
          <textarea name="reply" required maxLength={800} placeholder="Resposta do laboratório" className="min-h-20 rounded-md border border-[#cdd5d8] px-3 py-2" />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Responder"}</Button>
            <Feedback error={error} />
          </div>
        </form>
      )}
    </Panel>
  );
}
