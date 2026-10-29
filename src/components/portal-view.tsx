"use client";

import { ArrowLeft, CheckCircle2, ChevronDown, Clock3, MessageSquare, PackageCheck, RefreshCw, Search, TriangleAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { STATUS_LABEL, type OrderStatus } from "@/lib/domain/constants";
import { JOURNEY, forecastOrder, formatForecastDate, journeyIndex, type Forecast, type Risk } from "@/lib/domain/forecast";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { dueDeltaLabel } from "@/lib/domain/urgency";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PortalDetail, PortalOrder as PortalOrderRow } from "@/server/portal";
import { submitPortalMessage } from "@/server/portal-actions";
import { LensGauge, LensMark } from "./lens";
import { Button, Feedback } from "./ui";

/** No portal não temos as etapas internas; suavizamos o alerta durante a montagem. */
function portalForecast(order: { status: string; due_at: string | null }): Forecast & { risk: Risk } {
  const status = order.status as OrderStatus;
  const result = forecastOrder({ status, dueAt: order.due_at, stepsDone: status === "em_montagem" ? 2 : 0 });
  if (result.risk === "risco" && (status === "em_montagem" || status === "em_correcao" || status === "em_conferencia")) {
    return { ...result, risk: "atencao" };
  }
  return result;
}

function forecastLine(order: { status: string; due_at: string | null }, forecast: Forecast) {
  switch (forecast.risk) {
    case "pronta":
      return { text: "Pronta para retirada", tone: "text-[#1c6b43]", icon: CheckCircle2 };
    case "entregue":
      return { text: "Entregue", tone: "text-[#3b4650]", icon: PackageCheck };
    case "cancelada":
      return { text: "OS cancelada", tone: "text-[#6b7680]", icon: Clock3 };
    case "atrasada":
      return { text: `${dueDeltaLabel(order.due_at, new Date(), order.status as OrderStatus)} · o laboratório está priorizando`, tone: "text-[#a3261b]", icon: TriangleAlert };
    case "risco":
      return { text: `Pode passar do prazo (${formatForecastDate(order.due_at)}). Nova estimativa: ${formatForecastDate(forecast.projectedReadyAt)}`, tone: "text-[#a3261b]", icon: TriangleAlert };
    case "atencao":
      return { text: `Prazo apertado · previsto para ${formatForecastDate(order.due_at)}`, tone: "text-[#8a5a00]", icon: Clock3 };
    case "sem_prazo":
      return { text: "Sem prazo combinado", tone: "text-[#6e7c7a]", icon: Clock3 };
    default:
      return { text: `Previsto para ${formatForecastDate(order.due_at)}`, tone: "text-[#44524f]", icon: Clock3 };
  }
}

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LensMark size={36} />
      <div className="flex flex-col leading-tight">
        <span className="text-[15px] font-bold tracking-tight">Laboratório Óptico</span>
        <span className="text-xs text-[#6e7c7a]">{subtitle}</span>
      </div>
    </div>
  );
}

export function PortalHome({
  title,
  kind,
  token,
  orders,
  sellers,
  filters,
  error,
}: {
  title: string;
  kind: "loja" | "vendedor";
  token: string;
  orders: PortalOrderRow[];
  sellers: { id: string; name: string }[];
  filters: Record<string, string | undefined>;
  error: string | null;
}) {
  const enriched = useMemo(
    () => orders.map((order) => ({ order, forecast: portalForecast(order) })),
    [orders],
  );
  if (error) return <PortalDenied message={error} />;

  const ready = enriched.filter((item) => item.forecast.risk === "pronta");
  const active = enriched
    .filter((item) => !["pronta", "entregue", "cancelada"].includes(item.forecast.risk))
    .sort((a, b) => (a.order.due_at ?? "9999").localeCompare(b.order.due_at ?? "9999"));
  const closed = enriched.filter((item) => item.forecast.risk === "entregue" || item.forecast.risk === "cancelada");
  const alerts = active.filter((item) => item.forecast.risk === "atrasada" || item.forecast.risk === "risco");
  const base = `/acompanhar/${kind}/${token}`;
  const filtered = Boolean(filters.q || filters.status || filters.from || filters.to || filters.late || filters.ready || filters.seller);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-16 pt-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Brand subtitle="Acompanhamento de serviços" />
        <span className="flex items-center gap-1.5 text-xs text-[#6e7c7a]">
          <RefreshCw size={13} /> Atualiza sozinho a cada minuto
        </span>
      </header>
      <RefreshSoon />

      <section className="rounded-2xl bg-[#0e6b62] px-5 py-5 text-white sm:px-6">
        <p className="text-sm text-white/75">{kind === "loja" ? "Loja" : "Vendedor"}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Summary href={base} label="Em produção" value={active.length} />
          <Summary href={`${base}?ready=1`} label="Prontas p/ retirar" value={ready.length} highlight={ready.length > 0} />
          <Summary href={`${base}?late=1`} label="Atenção no prazo" value={alerts.length} alert={alerts.length > 0} />
          <Summary href={`${base}?status=entregue`} label="Entregues" value={closed.filter((item) => item.forecast.risk === "entregue").length} />
        </div>
      </section>

      {alerts.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-[#f3c4be] bg-[#fdecea] px-4 py-3 text-[13px] text-[#7a2a22]">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-[#d2382b]" />
          <span>
            <strong className="text-[#a3261b]">{alerts.length} serviço{alerts.length > 1 ? "s" : ""} pode{alerts.length > 1 ? "m" : ""} atrasar.</strong> O laboratório já
            foi alertado e está priorizando. Se precisar, mande um recado pela OS.
          </span>
        </div>
      ) : null}

      <form className="flex flex-col gap-2.5 rounded-2xl border border-[#e2e7e9] bg-white p-3 sm:p-4">
        <div className="flex gap-2.5">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-[#cdd5d8] bg-white px-3 text-[#6e7c7a] focus-within:border-[#0e6b62]">
            <Search size={17} />
            <input name="q" defaultValue={filters.q} placeholder="Número da OS, do pedido ou nome do cliente" className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[#13201f] shadow-none outline-none focus:shadow-none" />
          </label>
          <Button type="submit" className="h-11 px-5">Buscar</Button>
        </div>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-[#0e6b62]">
            Mais filtros <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {kind === "loja" ? (
              <select name="seller" defaultValue={filters.seller ?? ""} className="h-10 rounded-lg border border-[#cdd5d8] bg-white px-2.5 text-sm">
                <option value="">Todos os vendedores</option>
                {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
              </select>
            ) : null}
            <select name="status" defaultValue={filters.status ?? ""} className="h-10 rounded-lg border border-[#cdd5d8] bg-white px-2.5 text-sm">
              <option value="">Todas as situações</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input name="from" type="date" defaultValue={filters.from} aria-label="Entrada a partir de" className="h-10 rounded-lg border border-[#cdd5d8] bg-white px-2.5 text-sm" />
            <input name="to" type="date" defaultValue={filters.to} aria-label="Entrada até" className="h-10 rounded-lg border border-[#cdd5d8] bg-white px-2.5 text-sm" />
          </div>
        </details>
        {filtered ? (
          <Link href={base} className="self-start text-[13px] font-semibold text-[#0e6b62] hover:underline">Limpar filtros</Link>
        ) : null}
      </form>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#cdd5d8] bg-white px-4 py-10 text-center text-sm text-[#6e7c7a]">Nenhum serviço neste filtro.</p>
      ) : null}

      <OrderSection title="Prontas para retirar" icon={PackageCheck} items={ready} base={base} />
      <OrderSection title="Em produção" icon={Wrench} items={active} base={base} />
      <OrderSection title="Entregues e encerradas" icon={CheckCircle2} items={closed.slice(0, 30)} base={base} muted />
    </div>
  );
}

function Summary({ href, label, value, highlight, alert }: { href: string; label: string; value: number; highlight?: boolean; alert?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-1 rounded-xl px-3.5 py-3 transition-colors",
        alert ? "bg-[#d2382b] hover:bg-[#b42318]" : highlight ? "bg-white text-[#0a4f48] hover:bg-white/90" : "bg-white/10 hover:bg-white/20",
      )}
    >
      <span className={cn("text-xs", highlight && !alert ? "text-[#44524f]" : "text-white/80")}>{label}</span>
      <span className="tabular text-[28px] font-semibold leading-none">{value}</span>
    </Link>
  );
}

function OrderSection({
  title,
  icon: Icon,
  items,
  base,
  muted,
}: {
  title: string;
  icon: typeof Wrench;
  items: { order: PortalOrderRow; forecast: Forecast }[];
  base: string;
  muted?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#44524f]">
        <Icon size={16} /> {title} <span className="rounded-md bg-[#e7ebed] px-1.5 text-xs">{items.length}</span>
      </h2>
      <div className="grid gap-2.5 md:grid-cols-2">
        {items.map(({ order, forecast }) => (
          <OrderCard key={order.id} order={order} forecast={forecast} href={`${base}/os/${order.id}`} muted={muted} />
        ))}
      </div>
    </section>
  );
}

function MiniJourney({ status }: { status: string }) {
  const current = journeyIndex(status as OrderStatus);
  const delivered = status === "entregue";
  return (
    <div className="flex items-center gap-1">
      {JOURNEY.map((label, index) => (
        <span
          key={label}
          title={label}
          className={cn(
            "h-1.5 flex-1 rounded-full",
            index < current || delivered ? "bg-[#0e6b62]" : index === current ? "bg-[#0e6b62]/45" : "bg-[#e2e7e9]",
          )}
        />
      ))}
    </div>
  );
}

function OrderCard({ order, forecast, href, muted }: { order: PortalOrderRow; forecast: Forecast; href: string; muted?: boolean }) {
  const line = forecastLine(order, forecast);
  const LineIcon = line.icon;
  const urgent = order.priority === "critica";
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-white p-4 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(19,32,31,0.25)]",
        forecast.risk === "pronta" ? "border-[#9fd5b4]" : forecast.risk === "atrasada" || forecast.risk === "risco" ? "border-[#f3c4be]" : "border-[#e2e7e9]",
        muted && "opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono text-xs font-medium text-[#0e6b62]">
            {visibleOrderNumber(order)}
          </span>
          <span className="truncate text-base font-semibold">{order.client_name}</span>
        </div>
        <LensGauge value={forecast.progress} risk={forecast.risk} size={58} />
      </div>
      <MiniJourney status={order.status} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="font-medium text-[#44524f]">{STATUS_LABEL[order.status as OrderStatus] ?? order.status}</span>
        {urgent ? <span className="rounded-md bg-[#fdecea] px-1.5 py-0.5 text-[11px] font-semibold text-[#a3261b]">Urgente</span> : null}
      </div>
      <span className={cn("flex items-start gap-1.5 text-[13px] font-medium", line.tone)}>
        <LineIcon size={15} className="mt-0.5 shrink-0" />
        {line.text}
      </span>
      <span className="text-xs text-[#8a9694]">
        Entrada {formatDate(order.entered_at)}
        {order.seller_name ? ` · ${order.seller_name}` : ""}
        {order.store_name ? ` · ${order.store_name}` : ""}
      </span>
    </Link>
  );
}

export function PortalOrder({
  kind,
  token,
  detail,
  error,
}: {
  kind: "loja" | "vendedor";
  token: string;
  detail: PortalDetail | null;
  error: string | null;
}) {
  if (error || !detail) return <PortalDenied message={error ?? "OS não encontrada."} />;
  const forecast = portalForecast(detail);
  const line = forecastLine(detail, forecast);
  const LineIcon = line.icon;
  const current = journeyIndex(detail.status as OrderStatus);
  const delivered = detail.status === "entregue";
  const reachedAt = new Map<number, string>();
  reachedAt.set(0, detail.entered_at);
  for (const item of detail.history) {
    const index = journeyIndex(item.to_status as OrderStatus);
    if (!reachedAt.has(index)) reachedAt.set(index, item.created_at);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-16 pt-5 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Link href={`/acompanhar/${kind}/${token}`} className="flex items-center gap-1.5 text-sm font-semibold text-[#0e6b62] hover:underline">
          <ArrowLeft size={16} /> Meus serviços
        </Link>
        <span className="flex items-center gap-1.5 text-xs text-[#6e7c7a]"><RefreshCw size={13} /> Ao vivo</span>
      </header>
      <RefreshSoon />

      <section className="flex flex-col gap-4 rounded-2xl border border-[#e2e7e9] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-sm font-medium text-[#0e6b62]">
              {visibleOrderNumber(detail)}
            </span>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{detail.client_name}</h1>
            <p className="text-sm text-[#6e7c7a]">{detail.service_description}</p>
          </div>
          <LensGauge value={forecast.progress} risk={forecast.risk} size={108} label="concluído" />
        </div>
        <div className={cn("flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm font-medium", forecast.risk === "pronta" ? "bg-[#e3f4ea]" : forecast.risk === "atrasada" || forecast.risk === "risco" ? "bg-[#fdecea]" : forecast.risk === "atencao" ? "bg-[#fdf3dc]" : "bg-[#f7f9f9]", line.tone)}>
          <LineIcon size={18} className="mt-0.5 shrink-0" />
          {line.text}
        </div>

        <ol className="flex flex-col">
          {JOURNEY.map((label, index) => {
            const done = index < current || delivered;
            const now = index === current && !delivered;
            const at = reachedAt.get(index);
            return (
              <li key={label} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                      done ? "bg-[#0e6b62] text-white" : now ? "bg-white text-[#0e6b62] ring-2 ring-[#0e6b62]" : "bg-[#eef1f3] text-[#8a9694]",
                    )}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  {index < JOURNEY.length - 1 ? <span className={cn("min-h-5 w-0.5 flex-1", done ? "bg-[#0e6b62]" : "bg-[#e2e7e9]")} /> : null}
                </div>
                <div className="pb-4 pt-1">
                  <p className={cn("text-sm", now ? "font-semibold text-[#13201f]" : done ? "font-medium text-[#13201f]" : "text-[#8a9694]")}>
                    {label}
                    {now ? <span className="ml-2 rounded-md bg-[#e4f1ef] px-1.5 py-0.5 text-[11px] font-semibold text-[#0a4f48]">agora</span> : null}
                  </p>
                  {at && (done || now) ? <p className="text-xs text-[#6e7c7a]">{formatDateTime(at)}</p> : null}
                  {index === 4 && !done && !now && detail.due_at ? <p className="text-xs text-[#6e7c7a]">Previsto {formatForecastDate(detail.due_at)}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>

        <dl className="grid grid-cols-2 gap-3 border-t border-[#eef1f3] pt-4 text-sm sm:grid-cols-4">
          <Info label="Entrada" value={formatDateTime(detail.entered_at)} />
          <Info label="Prazo" value={formatDateTime(detail.due_at)} />
          <Info label="Vendedor" value={detail.seller_name || "—"} />
          <Info label="Loja" value={detail.store_name || "—"} />
        </dl>
      </section>

      <MessageBox token={token} orderId={detail.id} kind={kind} messages={detail.messages} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[#6e7c7a]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function MessageBox({
  token,
  orderId,
  kind,
  messages,
}: {
  token: string;
  orderId: string;
  kind: string;
  messages: PortalDetail["messages"];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#e2e7e9] bg-white p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <MessageSquare size={17} /> Conversa com o laboratório
      </h2>
      {messages.length === 0 ? (
        <p className="text-sm text-[#6e7c7a]">Precisa de algo? Mande um recado — a equipe vê na hora no painel.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {messages.map((item) => (
            <li key={item.id} className="flex flex-col gap-1.5">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#0e6b62] px-3.5 py-2.5 text-sm text-white">
                <p className="whitespace-pre-wrap">{item.body}</p>
                <p className="mt-1 text-right text-[11px] text-white/70">
                  {formatDateTime(item.created_at)} · {item.status === "novo" ? "enviado" : item.status === "visualizado" ? "visto" : "respondido"}
                </p>
              </div>
              {item.reply_body ? (
                <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-md bg-[#eef1f3] px-3.5 py-2.5 text-sm">
                  <p className="text-[11px] font-semibold text-[#0a4f48]">Laboratório</p>
                  <p className="whitespace-pre-wrap">{item.reply_body}</p>
                  {item.replied_at ? <p className="mt-1 text-[11px] text-[#6e7c7a]">{formatDateTime(item.replied_at)}</p> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);
          startTransition(async () => {
            const result = await submitPortalMessage(formData);
            if (!result.ok) {
              setMessage(null);
              setError(result.message);
              return;
            }
            setError(null);
            setMessage(result.message);
            form.reset();
            router.refresh();
          });
        }}
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="kind" value={kind} />
        <textarea
          name="body"
          required
          minLength={5}
          maxLength={800}
          placeholder="Ex.: cliente pediu para adiantar, troca de armação, dúvida no grau..."
          className="min-h-20 rounded-xl border border-[#cdd5d8] px-3.5 py-2.5 text-[15px] outline-none focus:border-[#0e6b62]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending} className="h-10 px-5">{pending ? "Enviando..." : "Enviar recado"}</Button>
          <Feedback error={error} message={message} />
        </div>
      </form>
    </section>
  );
}

function PortalDenied({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-20 text-center">
      <Brand subtitle="Acompanhamento de serviços" />
      <h1 className="mt-4 text-xl font-semibold">Acompanhamento indisponível</h1>
      <p className="text-sm text-[#6e7c7a]">{message}</p>
      <p className="text-xs text-[#8a9694]">Peça um novo link ao laboratório.</p>
    </div>
  );
}

function RefreshSoon() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
