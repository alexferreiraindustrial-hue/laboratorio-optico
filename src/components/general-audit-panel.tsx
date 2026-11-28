"use client";
// Auditoria geral: anota as OS em aberto, acompanha o que foi bipado e coloca em off o que não foi encontrado.
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveRestore, PowerOff, RefreshCw, ScanLine, Search } from "lucide-react";
import { finishGeneralAudit, reactivateOrder, startGeneralAudit } from "@/server/audit-actions";
import type { GeneralAuditData, GeneralAuditOrder, OffOrder } from "@/server/general-audit";
import { STATUS_LABEL, type OrderStatus } from "@/lib/domain/constants";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { formatDateTime } from "@/lib/format";
import { Button } from "./ui";

const statusName = (status: string) => STATUS_LABEL[status as OrderStatus] ?? status;
const ORDER = ["aguardando_lentes", "aguardando_montagem", "em_montagem", "em_correcao", "em_conferencia", "pronto"];

export function GeneralAuditPanel({ data, canManage }: { data: GeneralAuditData; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!data.session) return;
    const timer = window.setInterval(() => router.refresh(), 30000);
    return () => window.clearInterval(timer);
  }, [data.session, router]);

  if (!data.ready) {
    return <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm">A auditoria geral ainda não foi instalada no banco. Rode o arquivo <b>auditoria-geral.sql</b> no Supabase e atualize esta página.</p>;
  }

  function begin() {
    if (!window.confirm("Iniciar a auditoria geral? Todas as OS em aberto ficam anotadas como \"a conferir\". Nada muda nas OS até você bipar ou encerrar.")) return;
    start(async () => {
      const result = await startGeneralAudit();
      if (!result.ok) return void toast.error(result.message);
      toast.success(result.message ?? "Auditoria iniciada.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      {data.session ? <OpenAudit data={data} canManage={canManage} /> : (
        <section className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="text-lg font-semibold">Como funciona</h2>
          <ol className="grid list-decimal gap-1 pl-5 text-sm">
            <li>Inicie a auditoria. Nenhuma OS muda: elas só ficam anotadas como “a conferir”.</li>
            <li>No PDV, aperte <b>F8 Auditoria</b>, escolha onde você está (ex.: Pronto) e bipe tudo o que está ali. A OS vai para a posição bipada e fica conferida.</li>
            <li>Volte aqui, confira a lista do que não foi bipado e coloque em <b>off</b>. Os dados ficam guardados e a OS volta sozinha se for bipada depois.</li>
          </ol>
          {data.lastFinished ? <p className="text-xs text-[var(--muted)]">Última auditoria encerrada em {formatDateTime(data.lastFinished.finished_at)} · {data.lastFinished.off_count} OS em off.</p> : null}
          {canManage ? <div><Button disabled={pending} onClick={begin}><ScanLine size={17} aria-hidden />Iniciar auditoria geral</Button></div> : <p className="text-sm text-[var(--muted)]">Somente administrador ou gestor inicia a auditoria.</p>}
        </section>
      )}
      <OffList off={data.off} />
    </div>
  );
}

function OpenAudit({ data, canManage }: { data: GeneralAuditData; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const missing = useMemo(() => data.orders.filter((order) => !order.found_at), [data.orders]);
  const found = data.orders.length - missing.length;
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const selected = missing.filter((order) => !unchecked.has(order.id));
  const percent = data.orders.length ? Math.round((found / data.orders.length) * 100) : 0;

  const byStatus = useMemo(() => {
    const groups = new Map<string, { total: number; found: number }>();
    for (const order of data.orders) {
      const group = groups.get(order.status) ?? { total: 0, found: 0 };
      group.total++;
      if (order.found_at) group.found++;
      groups.set(order.status, group);
    }
    return [...groups.entries()].sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
  }, [data.orders]);

  const term = query.trim().toLowerCase();
  const visible = missing.filter((order) => !term || `${visibleOrderNumber(order)} ${order.client_name} ${order.seller_name ?? ""}`.toLowerCase().includes(term));
  const grouped = useMemo(() => {
    const groups = new Map<string, GeneralAuditOrder[]>();
    for (const order of visible) groups.set(order.status, [...(groups.get(order.status) ?? []), order]);
    return [...groups.entries()].sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
  }, [visible]);

  function toggle(id: string) {
    setUnchecked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function finish(withOff: boolean) {
    const ids = withOff ? selected.map((order) => order.id) : [];
    const text = withOff
      ? `Encerrar a auditoria e colocar ${ids.length} OS em off? Elas saem da operação, mas os dados ficam guardados e voltam se forem bipadas.`
      : "Encerrar a auditoria sem colocar nenhuma OS em off?";
    if (!window.confirm(text)) return;
    start(async () => {
      const result = await finishGeneralAudit(ids);
      if (!result.ok) return void toast.error(result.message);
      toast.success(result.message ?? "Auditoria encerrada.");
      router.refresh();
    });
  }

  return (
    <section className="grid gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Auditoria em andamento</h2>
          <p className="text-xs text-[var(--muted)]">Iniciada em {formatDateTime(data.session!.started_at)} · atualiza sozinha a cada 30 segundos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/pdv" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white"><ScanLine size={17} aria-hidden />Bipar no PDV (F8)</Link>
          <Button variant="secondary" onClick={() => router.refresh()}><RefreshCw size={16} aria-hidden />Atualizar</Button>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-sm"><span><b className="text-2xl">{found}</b> de {data.orders.length} conferidas</span><span className="font-semibold">{percent}%</span></div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--background)]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da auditoria">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-3">
        {byStatus.map(([status, group]) => (
          <li key={status} className="rounded-lg border border-[var(--line)] p-3">
            <p className="text-xs text-[var(--muted)]">No sistema como</p>
            <p className="text-sm font-semibold">{statusName(status)}</p>
            <p className="mt-1 text-sm"><b>{group.found}</b> de {group.total} bipadas</p>
          </li>
        ))}
      </ul>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Ainda não bipadas · {missing.length}</h3>
          <label className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar OS, cliente, vendedora" aria-label="Buscar nas não bipadas" className="min-h-11 w-64 rounded-lg border border-[var(--line)] bg-[var(--surface)] pl-9 pr-3 text-sm" />
          </label>
        </div>
        <p className="text-xs text-[var(--muted)]">As marcadas vão para off no encerramento. Desmarque o que você sabe que ainda está no laboratório (ex.: com o médico ou na bancada de alguém) e bipe depois.</p>
        {grouped.map(([status, orders]) => (
          <details key={status} open className="rounded-lg border border-[var(--line)]">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">{statusName(status)} · {orders.length}</summary>
            <ul>
              {orders.map((order) => (
                <li key={order.id} className="flex items-center gap-3 border-t border-[var(--line)] px-3 py-2">
                  <input type="checkbox" checked={!unchecked.has(order.id)} onChange={() => toggle(order.id)} aria-label={`Colocar em off a OS ${visibleOrderNumber(order)}`} className="h-5 w-5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{order.client_name}</p>
                    <p className="text-xs text-[var(--muted)]"><span className="font-mono">{visibleOrderNumber(order)}</span> · {order.seller_name || "Sem vendedora"}</p>
                  </div>
                  <Link href={`/laboratorio?os=${order.id}`} className="text-xs font-semibold text-[var(--link)]">Abrir</Link>
                </li>
              ))}
            </ul>
          </details>
        ))}
        {!missing.length ? <p className="rounded-lg bg-[var(--accent-soft)] p-3 text-sm">Todas as OS foram bipadas. Pode encerrar a auditoria.</p> : null}
      </div>

      {canManage ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
          <Button disabled={pending || !selected.length} onClick={() => finish(true)}><PowerOff size={16} aria-hidden />Encerrar e colocar em off ({selected.length})</Button>
          <Button variant="secondary" disabled={pending} onClick={() => finish(false)}>Encerrar sem colocar em off</Button>
        </div>
      ) : null}
    </section>
  );
}

function OffList({ off }: { off: OffOrder[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  if (!off.length) return null;
  const term = query.trim().toLowerCase();
  const visible = off.filter((order) => !term || `${visibleOrderNumber(order)} ${order.client_name} ${order.seller_name ?? ""}`.toLowerCase().includes(term));
  function reactivate(order: OffOrder) {
    start(async () => {
      const result = await reactivateOrder(order.id);
      if (!result.ok) return void toast.error(result.message);
      toast.success(`${order.client_name}: ${result.message}`);
      router.refresh();
    });
  }
  return (
    <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <summary className="cursor-pointer text-base font-semibold">OS em off · {off.length}</summary>
      <p className="mt-2 text-xs text-[var(--muted)]">Fora da operação, com todos os dados guardados. Bipar a OS no PDV ou clicar em Reativar traz de volta na mesma etapa.</p>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar OS, cliente, vendedora" aria-label="Buscar nas OS em off" className="mt-3 min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm sm:w-72" />
      <ul className="mt-3">
        {visible.slice(0, 300).map((order) => (
          <li key={order.id} className="flex items-center gap-3 border-t border-[var(--line)] py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{order.client_name}</p>
              <p className="text-xs text-[var(--muted)]"><span className="font-mono">{visibleOrderNumber(order)}</span> · {statusName(order.status)} · {order.seller_name || "Sem vendedora"} · off desde {formatDateTime(order.audit_off_at)}</p>
            </div>
            <Link href={`/laboratorio/${order.id}`} className="text-xs font-semibold text-[var(--link)]">Abrir</Link>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => reactivate(order)}><ArchiveRestore size={15} aria-hidden />Reativar</Button>
          </li>
        ))}
      </ul>
      {visible.length > 300 ? <p className="mt-2 text-xs text-[var(--muted)]">Mostrando 300 de {visible.length}. Use a busca.</p> : null}
    </details>
  );
}

