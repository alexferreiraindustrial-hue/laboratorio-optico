import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/shell";
import { STATUS_TONE, StatusBadge } from "@/components/status-badge";
import { Button, Panel, PanelHeader, Select } from "@/components/ui";
import { addDays, dayRange, monthRange, weekRange, zonedStart, zonedYmd } from "@/lib/domain/calendar";
import { QUEUE_STATUSES, STATUS_LABEL, type AppRole, type OrderStatus } from "@/lib/domain/constants";
import { can } from "@/lib/domain/permissions";
import { countByKey, qualityRate } from "@/lib/domain/quality";
import { countCompleted, dailySeries, goalPercent, projectProduction, type ProductionOrder } from "@/lib/domain/production";
import { stockTone } from "@/lib/domain/stock";
import { dueDeltaLabel, type Urgency } from "@/lib/domain/urgency";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { StockRow } from "@/lib/types";
import { NotifySeller, ProgressBar, RiskChip } from "@/components/forecast-ui";
import { forecastOrder, formatForecastDate, sellerUpdateMessage, whatsappLink } from "@/lib/domain/forecast";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { loadCatalogs, stepsDoneByOrder } from "@/server/queries";
import { requireProfile } from "@/server/session";

type Period = "hoje" | "semana" | "mes" | "periodo";

const PERIODS: { key: Period; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "periodo", label: "Período" },
];

type OpenOrder = {
  id: string;
  number: string;
  client_name: string;
  external_order_id: string | null;
  store_name: string | null;
  seller_id: string | null;
  seller_name: string | null;
  due_at: string | null;
  status: OrderStatus;
  urgency: Urgency;
  laboratory_id: string | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; laboratory?: string }>;
}) {
  const filters = await searchParams;
  const { supabase, profile } = await requireProfile();
  const role = profile.role as AppRole;
  const now = new Date();
  const day = dayRange(now);
  const week = weekRange(now);
  const month = monthRange(now);
  const period: Period = (["hoje", "semana", "mes", "periodo"] as const).includes(filters.period as Period)
    ? (filters.period as Period)
    : filters.from || filters.to
      ? "periodo"
      : "mes";
  const custom = {
    start: filters.from ? zonedStart(filters.from) : month.start,
    end: filters.to ? zonedStart(addDays(filters.to, 1)) : month.end,
  };
  const range = period === "hoje" ? day : period === "semana" ? week : period === "mes" ? month : custom;
  const periodStart = range.start;
  const periodEnd = range.end;
  const lab = filters.laboratory || null;

  const [catalogs, ordersResult, openResult, goalsResult, qualityResult, stockResult] = await Promise.all([
    loadCatalogs(),
    supabase.from("service_orders").select("id, status, entered_at, completed_at, due_at, laboratory_id"),
    supabase
      .from("orders_enriched")
      .select("id, number, client_name, external_order_id, store_name, seller_id, seller_name, due_at, status, urgency, laboratory_id")
      .in("status", QUEUE_STATUSES)
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase.from("production_goals").select("*").order("valid_from", { ascending: false }),
    supabase
      .from("quality_occurrences")
      .select("id, order_id, status, occurred_at, quality_categories(name)")
      .gte("occurred_at", periodStart.toISOString())
      .lt("occurred_at", periodEnd.toISOString()),
    supabase.from("lens_prescription_stock").select("id, public_code, current_qty, min_qty, ideal_qty").eq("active", true),
  ]);
  const weekdays = (catalogs.settings.schedule?.weekdays as number[] | undefined) ?? [1, 2, 3, 4, 5];

  const normalized: ProductionOrder[] = (ordersResult.data ?? [])
    .map((order) => ({
      id: order.id,
      status: order.status,
      enteredAt: order.entered_at,
      completedAt: order.completed_at,
      dueAt: order.due_at,
      laboratoryId: order.laboratory_id,
    }))
    .filter((order) => !lab || order.laboratoryId === lab);
  const open = ((openResult.data ?? []) as OpenOrder[]).filter((order) => !lab || order.laboratory_id === lab);

  const todayYmd = zonedYmd(now);
  function goalFor(scope: "daily" | "weekly" | "monthly") {
    const rows = (goalsResult.data ?? []).filter((goal) => goal.scope === scope && goal.valid_from <= todayYmd);
    const specific = lab ? rows.find((goal) => goal.laboratory_id === lab) : null;
    return ((specific ?? rows.find((goal) => !goal.laboratory_id))?.target ?? null) as number | null;
  }
  const dailyGoal = goalFor("daily");
  const weeklyGoal = goalFor("weekly");
  const monthlyGoal = goalFor("monthly");
  const doneToday = countCompleted(normalized, day.start, day.end);
  const doneWeek = countCompleted(normalized, week.start, week.end);
  const doneMonth = countCompleted(normalized, month.start, month.end);
  const donePeriod = countCompleted(normalized, periodStart, periodEnd);
  const periodGoal = period === "hoje" ? dailyGoal : period === "semana" ? weeklyGoal : period === "mes" ? monthlyGoal : null;
  const projection = projectProduction({ completed: donePeriod, goal: periodGoal, periodStart, periodEnd, now, weekdays });

  const isLate = (order: OpenOrder) => !!order.due_at && new Date(order.due_at).getTime() < now.getTime();
  const isToday = (order: OpenOrder) => !!order.due_at && !isLate(order) && zonedYmd(new Date(order.due_at)) === todayYmd;

  const quality = qualityResult.data ?? [];
  const openQuality = quality.filter((item) => item.status === "aberta" || item.status === "em_tratamento");
  const openQualityOrders = new Set(openQuality.map((item) => item.order_id));

  const pipeline = QUEUE_STATUSES.map((status) => {
    const list = open.filter((order) => order.status === status);
    const late = list.filter(isLate).length;
    const note =
      status === "em_correcao"
        ? `${list.length} em correção`
        : status === "pronto"
          ? "Aguardando retirada"
          : late
            ? `${late} atrasada${late > 1 ? "s" : ""}`
            : "No prazo";
    return { status, count: list.length, note, alert: late > 0 || (status === "em_correcao" && list.length > 0) };
  });

  const stepsDone = await stepsDoneByOrder(open.map((order) => order.id));
  const sellerById = new Map(catalogs.sellers.map((seller) => [seller.id, seller]));
  const RISK_ORDER: Record<string, number> = { atrasada: 0, risco: 1, atencao: 2 };
  const radar = open
    .map((order) => ({ order, forecast: forecastOrder({ status: order.status, dueAt: order.due_at, stepsDone: stepsDone.get(order.id) ?? 0, now }) }))
    .filter(({ order, forecast }) => forecast.risk in RISK_ORDER || openQualityOrders.has(order.id) || isToday(order))
    .sort((a, b) => (RISK_ORDER[a.forecast.risk] ?? 3) - (RISK_ORDER[b.forecast.risk] ?? 3) || (a.forecast.slackHours ?? 0) - (b.forecast.slackHours ?? 0));
  const riskCount = radar.filter(({ forecast }) => forecast.risk === "risco").length;
  const lateCount = radar.filter(({ forecast }) => forecast.risk === "atrasada").length;
  const attention = radar.slice(0, 10).map(({ order, forecast }) => {
    const seller = order.seller_id ? sellerById.get(order.seller_id) : undefined;
    const message = sellerUpdateMessage({
      sellerName: seller?.name ?? order.seller_name,
      number: visibleOrderNumber(order),
      clientName: order.client_name,
      status: order.status,
      dueAt: order.due_at,
      forecast,
      externalOrderId: order.external_order_id,
    });
    const deadline =
      forecast.risk === "atrasada"
        ? dueDeltaLabel(order.due_at, now, order.status)
        : forecast.risk === "risco"
          ? `Vence ${formatForecastDate(order.due_at)} · estimativa ${formatForecastDate(forecast.projectedReadyAt)}`
          : isToday(order)
            ? `Vence hoje, ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(order.due_at!))}`
            : forecast.reason;
    return {
      ...order,
      forecast,
      reason: openQualityOrders.has(order.id) ? `${deadline} · ocorrência aberta` : deadline,
      message,
      link: whatsappLink(seller?.whatsapp || seller?.phone, message),
      sellerName: seller?.name ?? order.seller_name,
    };
  });

  const lowStock = ((stockResult.data ?? []) as StockRow[]).filter(
    (item) => stockTone(item.current_qty, item.min_qty, item.ideal_qty) !== "verde",
  );

  const last14Start = zonedStart(addDays(todayYmd, -13));
  const bars = dailySeries(normalized, last14Start, day.end, dailyGoal).map((item) => ({ day: item.day.slice(8), produced: item.produced }));
  const barMax = Math.max(1, dailyGoal ?? 0, ...bars.map((bar) => bar.produced));

  const byCategory = countByKey(
    quality.map((item) => {
      const category = item.quality_categories as { name?: string } | { name?: string }[] | null;
      return (Array.isArray(category) ? category[0]?.name : category?.name) ?? "Sem categoria";
    }),
  );
  const categoryMax = Math.max(1, ...byCategory.map((item) => item.count));
  const enteredIds = normalized
    .filter((order) => order.enteredAt && new Date(order.enteredAt) >= periodStart && new Date(order.enteredAt) < periodEnd)
    .map((order) => order.id);
  const rate = qualityRate(enteredIds, quality.map((item) => item.order_id));

  const periodHref = (key: Period) => {
    const params = new URLSearchParams();
    params.set("period", key);
    if (lab) params.set("laboratory", lab);
    if (key === "periodo") {
      params.set("from", filters.from ?? month.startYmd);
      params.set("to", filters.to ?? zonedYmd(new Date(month.end.getTime() - 1)));
    }
    return `/dashboard?${params.toString()}`;
  };
  const rangeLabel = `${formatDate(periodStart)} – ${formatDate(new Date(periodEnd.getTime() - 1))}`;
  const todayPct = goalPercent(doneToday, dailyGoal);

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title="Dashboard" description="A fila mostra a situação atual. Produção e qualidade seguem o período selecionado.">
        <div className="flex gap-0.5 rounded-[9px] bg-[#e7ebed] p-[3px]">
          {PERIODS.map((item) => {
            const on = item.key === period;
            return (
              <Link
                key={item.key}
                href={periodHref(item.key)}
                className={`flex h-[30px] items-center rounded-[7px] px-3 text-[13px] font-semibold ${on ? "bg-white text-[#13201f] shadow-[0_1px_2px_rgba(19,32,31,0.12)]" : "text-[#6e7c7a] hover:text-[#13201f]"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <span className="font-mono text-[13px] text-[#44524f]">{rangeLabel}</span>
        {can(role, "orders.write") ? (
          <Button asChild>
            <Link href="/laboratorio/nova">
              <Plus size={16} />
              Nova OS
            </Link>
          </Button>
        ) : null}
      </PageHeading>

      {period === "periodo" || catalogs.laboratories.length > 1 ? (
        <form method="get" className="-mt-2 flex flex-wrap items-center gap-2.5">
          <input type="hidden" name="period" value={period} />
          {period === "periodo" ? (
            <>
              <input type="date" name="from" defaultValue={filters.from ?? month.startYmd} aria-label="Período inicial" className="h-9 rounded-lg border border-[#cdd5d8] bg-white px-3 text-sm outline-none focus:border-[#0e6b62]" />
              <input type="date" name="to" defaultValue={filters.to ?? zonedYmd(new Date(month.end.getTime() - 1))} aria-label="Período final" className="h-9 rounded-lg border border-[#cdd5d8] bg-white px-3 text-sm outline-none focus:border-[#0e6b62]" />
            </>
          ) : null}
          {catalogs.laboratories.length > 1 ? (
            <Select name="laboratory" defaultValue={filters.laboratory ?? ""} className="w-auto min-w-52">
              <option value="">Todos os laboratórios</option>
              {catalogs.laboratories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </Select>
          ) : null}
          <Button type="submit" variant="secondary">Aplicar</Button>
        </form>
      ) : null}

      {riskCount + lateCount > 0 ? (
        <a
          href="#radar"
          className="flex flex-wrap items-center gap-4 rounded-xl border border-[#f3c4be] bg-[#fdecea] px-5 py-3.5 transition-colors hover:border-[#d2382b]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d2382b] text-base font-bold text-white">!</span>
          <span className="flex flex-1 flex-col">
            <span className="text-[15px] font-semibold text-[#a3261b]">
              {riskCount > 0 ? `${riskCount} OS ${riskCount > 1 ? "vão" : "vai"} atrasar se nada mudar` : ""}
              {riskCount > 0 && lateCount > 0 ? " · " : ""}
              {lateCount > 0 ? `${lateCount} já atrasada${lateCount > 1 ? "s" : ""}` : ""}
            </span>
            <span className="text-[13px] text-[#7a2a22]">Priorize na bancada e avise o vendedor agora, antes que o cliente cobre.</span>
          </span>
          <span className="text-[13px] font-semibold text-[#a3261b]">Ver radar ↓</span>
        </a>
      ) : open.length > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-[#cfe6d8] bg-[#e3f4ea] px-5 py-3 text-[13px] font-medium text-[#1c6b43]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#23955a] text-xs text-white">✓</span>
          Nenhuma OS em risco de atraso. Todas as previsões cabem no prazo.
        </div>
      ) : null}

      <Panel className="overflow-hidden">
        <PanelHeader title="Fila agora">
          {open.length} OS em andamento · clique para abrir no Laboratório
        </PanelHeader>
        <div className="grid grid-cols-2 gap-px bg-[#e2e7e9] sm:grid-cols-3 xl:grid-cols-6">
          {pipeline.map((stage) => (
            <Link
              key={stage.status}
              href={`/laboratorio?status=${stage.status}`}
              className="flex flex-col gap-2.5 bg-white px-5 pb-5 pt-[18px] hover:bg-[#f7f9f9]"
            >
              <span className="flex items-center gap-[7px] text-[13px] font-medium text-[#44524f]">
                <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: STATUS_TONE[stage.status].dot }} />
                {stage.status === "em_conferencia" ? "Em conferência" : STATUS_LABEL[stage.status]}
              </span>
              <span className="tabular text-[34px] font-semibold leading-none tracking-[-0.03em]">{stage.count}</span>
              <span className={`text-xs ${stage.alert ? "font-semibold text-[#b42318]" : "text-[#6e7c7a]"}`}>{stage.note}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader title="Produção">Conta a data de conclusão da montagem</PanelHeader>
        <div className="grid grid-cols-1 gap-px bg-[#e2e7e9] sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Concluídas hoje" value={doneToday} suffix={dailyGoal ? `/ meta ${dailyGoal}` : undefined}>
            {todayPct != null ? (
              <>
                <div className="h-1.5 overflow-hidden rounded-[3px] bg-[#e7ebed]">
                  <div className="h-full bg-[#0e6b62]" style={{ width: `${Math.min(100, todayPct * 100)}%` }} />
                </div>
                <span className="text-xs text-[#6e7c7a]">{formatPercent(todayPct)} da meta diária</span>
              </>
            ) : (
              <GoalHint />
            )}
          </Stat>
          <Stat label="Na semana" value={doneWeek} suffix={weeklyGoal ? `/ meta ${weeklyGoal}` : undefined}>
            {weeklyGoal ? <span className="text-xs text-[#6e7c7a]">{formatPercent(goalPercent(doneWeek, weeklyGoal))} da meta semanal</span> : <GoalHint scope="semanal" />}
          </Stat>
          <Stat label="No mês" value={doneMonth} suffix={monthlyGoal ? `/ meta ${monthlyGoal}` : undefined}>
            {monthlyGoal ? <span className="text-xs text-[#6e7c7a]">{formatPercent(goalPercent(doneMonth, monthlyGoal))} da meta mensal</span> : <GoalHint scope="mensal" />}
          </Stat>
          <Stat
            label="Projeção do período"
            value={projection.projected == null ? "—" : formatNumber(projection.projected, 1)}
            suffix={projection.projected == null ? undefined : "montagens"}
          >
            <span className="text-pretty text-xs text-[#6e7c7a]">
              {projection.dailyAverage == null
                ? projection.note
                : `Média diária ${formatNumber(projection.dailyAverage, 1)} · ${projection.remainingWorkingDays} dias de funcionamento restantes. Estimativa, não garantia.`}
            </span>
          </Stat>
        </div>
        <div className="border-t border-[#e2e7e9] px-5 pb-4 pt-[18px]">
          <div className="mb-2 flex justify-between text-xs text-[#6e7c7a]">
            <span>Montagens concluídas por dia · últimos 14 dias</span>
            {dailyGoal ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 border-t border-dashed border-[#0e6b62]" />
                Meta diária {dailyGoal}
              </span>
            ) : null}
          </div>
          <div className="relative grid h-[120px] grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-2 border-b border-[#e2e7e9]">
            {dailyGoal ? (
              <div className="absolute inset-x-0 border-t border-dashed border-[#0e6b62] opacity-60" style={{ bottom: `${(dailyGoal / barMax) * 100}%` }} />
            ) : null}
            {bars.map((bar, index) => (
              <div
                key={bar.day + index}
                title={`${bar.produced} montagem(ns)`}
                className="min-h-[2px] rounded-t-[3px]"
                style={{ height: `${(bar.produced / barMax) * 100}%`, background: index === bars.length - 1 ? "#0e6b62" : "#9cc9c3" }}
              />
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-2">
            {bars.map((bar, index) => (
              <span key={bar.day + index} className="text-center font-mono text-[10px] text-[#8a9694]">{bar.day}</span>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-5">
        <Panel className="overflow-hidden">
          <div id="radar" className="scroll-mt-20" />
          <PanelHeader title="Radar de prazos">
            <span>Avisa antes do atraso · {radar.length} OS</span>
          </PanelHeader>
          {attention.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#6e7c7a]">Nada atrasado, em risco ou vencendo hoje. Tudo no prazo.</p>
          ) : (
            attention.map((order) => (
              <div key={order.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#eef1f3] px-5 py-3.5 last:border-b-0 hover:bg-[#f7f9f9]">
                <Link href={`/laboratorio/${order.id}`} className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-medium text-[#0e6b62]">{visibleOrderNumber(order)}</span>
                    <span className="truncate text-[13px] font-semibold">{order.client_name}</span>
                    <RiskChip risk={order.forecast.risk} />
                  </span>
                  <span className={`text-xs font-medium ${order.forecast.risk === "atrasada" || order.forecast.risk === "risco" ? "text-[#a3261b]" : "text-[#8a5a00]"}`}>
                    {order.reason}
                  </span>
                  <span className="flex items-center gap-3">
                    <ProgressBar value={order.forecast.progress} risk={order.forecast.risk} className="w-36" />
                    <span className="truncate text-xs text-[#6e7c7a]">
                      {STATUS_LABEL[order.status]} · {order.sellerName || "Sem vendedor"}
                    </span>
                  </span>
                </Link>
                {order.sellerName ? <NotifySeller message={order.message} link={order.link} sellerName={order.sellerName} compact /> : <StatusBadge status={order.status} />}
              </div>
            ))
          )}
          {lowStock.length > 0 ? (
            <Link href="/estoque" className="flex items-center justify-between border-t border-[#e2e7e9] bg-[#fdf3dc]/50 px-5 py-3 text-[13px] hover:bg-[#fdf3dc]">
              <span className="font-semibold text-[#8a5a00]">{lowStock.length} lente(s) com estoque baixo ou zerado</span>
              <span className="font-medium text-[#0e6b62]">Ver estoque</span>
            </Link>
          ) : null}
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader title="Qualidade no período">
            <Link href="/relatorios" className="font-medium text-[#0e6b62] hover:underline">Relatório</Link>
          </PanelHeader>
          <div className="grid grid-cols-2 gap-px border-b border-[#e2e7e9] bg-[#e2e7e9]">
            <div className="flex flex-col gap-1.5 bg-white px-5 py-4">
              <span className="text-[13px] font-medium text-[#44524f]">OS com ocorrência</span>
              <span className="tabular text-[28px] font-semibold leading-none tracking-[-0.03em]">
                {rate.percent == null ? "—" : formatPercent(rate.percent)}
              </span>
              <span className="text-xs text-[#6e7c7a]">{rate.affected} de {rate.orders} OS</span>
            </div>
            <div className="flex flex-col gap-1.5 bg-white px-5 py-4">
              <span className="text-[13px] font-medium text-[#44524f]">Ocorrências abertas</span>
              <span className={`tabular text-[28px] font-semibold leading-none tracking-[-0.03em] ${openQuality.length ? "text-[#b42318]" : ""}`}>
                {openQuality.length}
              </span>
              <span className="text-xs text-[#6e7c7a]">Bloqueia “Pronto”</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 px-5 pb-[18px] pt-3.5">
            <span className="text-xs font-semibold text-[#8a9694]">Por categoria</span>
            {byCategory.length === 0 ? (
              <span className="text-[13px] text-[#6e7c7a]">Nenhuma ocorrência no período.</span>
            ) : (
              byCategory.slice(0, 6).map((item) => (
                <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_120px_24px] items-center gap-3 text-[13px]">
                  <span className="truncate">{item.key}</span>
                  <div className="h-1.5 rounded-[3px] bg-[#e7ebed]">
                    <div className="h-full rounded-[3px] bg-[#d2382b]" style={{ width: `${(item.count / categoryMax) * 100}%` }} />
                  </div>
                  <span className="text-right font-mono">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  children,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 bg-white px-5 py-[18px]">
      <span className="text-[13px] font-medium text-[#44524f]">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="tabular text-[34px] font-semibold leading-none tracking-[-0.03em]">{value}</span>
        {suffix ? <span className="text-sm text-[#6e7c7a]">{suffix}</span> : null}
      </div>
      {children}
    </div>
  );
}

function GoalHint({ scope = "diária" }: { scope?: string }) {
  return (
    <span className="text-xs text-[#6e7c7a]">
      Meta {scope} não definida ·{" "}
      <Link href="/configuracoes" className="text-[#0e6b62] hover:underline">Definir</Link>
    </span>
  );
}
