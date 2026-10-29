import Link from "next/link";
import { DownloadCsv } from "@/components/download-csv";
import { PrintButton } from "@/components/print-button";
import { PageHeading } from "@/components/shell";
import { Button, Input, Panel, Select } from "@/components/ui";
import { addDays, zonedStart, zonedYmd } from "@/lib/domain/calendar";
import { STEP_LABEL, type StepKey } from "@/lib/domain/constants";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { averageLeadHours, countCompleted, goalPercent, isOpenLate, type ProductionOrder } from "@/lib/domain/production";
import { countByKey, qualityRate } from "@/lib/domain/quality";
import { stockTone } from "@/lib/domain/stock";
import { formatDateTime, formatDiopter, formatHours, formatPercent } from "@/lib/format";
import { loadCatalogs } from "@/server/queries";
import { requireProfile } from "@/server/session";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; laboratory?: string; seller?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const { supabase } = await requireProfile();
  const now = new Date();
  const from = filters.from ?? zonedYmd(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = filters.to ?? zonedYmd(now);
  const start = zonedStart(from);
  const end = zonedStart(addDays(to, 1));

  const [catalogs, ordersResult, qualityResult, movementsResult, stockResult, goalsResult] = await Promise.all([
    loadCatalogs(),
    supabase.from("orders_enriched").select("*"),
    supabase.from("quality_occurrences").select("id, order_id, status, step_key, occurred_at, quality_categories(name)").gte("occurred_at", start.toISOString()).lt("occurred_at", end.toISOString()),
    supabase.from("stock_movements").select("id, movement_type, quantity, signed_delta, reason, created_at, order_id, stock_id, lens_prescription_stock(public_code, sphere_cents, cylinder_cents)").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at", { ascending: false }).limit(500),
    supabase.from("lens_prescription_stock").select("*").eq("active", true),
    supabase.from("production_goals").select("*").lte("valid_from", to).order("valid_from", { ascending: false }),
  ]);

  let orders = ordersResult.data ?? [];
  if (filters.laboratory) orders = orders.filter((order) => order.laboratory_id === filters.laboratory);
  if (filters.seller) orders = orders.filter((order) => order.seller_id === filters.seller);
  if (filters.status) orders = orders.filter((order) => order.status === filters.status);
  const production: ProductionOrder[] = orders.map((order) => ({
    id: order.id,
    status: order.status,
    enteredAt: order.entered_at,
    completedAt: order.completed_at,
    dueAt: order.due_at,
    laboratoryId: order.laboratory_id,
    sellerId: order.seller_id,
  }));
  const completed = countCompleted(production, start, end);
  const received = production.filter((order) => order.enteredAt && new Date(order.enteredAt) >= start && new Date(order.enteredAt) < end);
  const late = production.filter((order) => isOpenLate(order, now));
  const waiting = production.filter((order) => order.status === "aguardando_lentes");
  const monthlyGoal = (goalsResult.data ?? []).find((goal) => goal.scope === "monthly" && (!filters.laboratory || goal.laboratory_id === filters.laboratory || !goal.laboratory_id));
  const occurrences = qualityResult.data ?? [];
  const rate = qualityRate(received.map((order) => order.id), occurrences.map((item) => item.order_id));
  const byLab = countByKey(production.filter((order) => order.completedAt && new Date(order.completedAt) >= start && new Date(order.completedAt) < end && (order.status === "pronto" || order.status === "entregue")).map((order) => orders.find((item) => item.id === order.id)?.laboratory_name ?? "Laboratório"));
  const byStep = countByKey(occurrences.map((item) => (item.step_key ? STEP_LABEL[item.step_key as StepKey] : "Não informada")));
  const byCategory = countByKey(occurrences.map((item) => {
    const category = item.quality_categories as { name?: string } | { name?: string }[] | null;
    return (Array.isArray(category) ? category[0]?.name : category?.name) ?? "Sem categoria";
  }));
  const lowStock = (stockResult.data ?? []).filter((item) => stockTone(item.current_qty, item.min_qty, item.ideal_qty) !== "verde");
  const consumption = (movementsResult.data ?? []).filter((item) => item.movement_type === "consumo" || item.movement_type === "saida");

  const summaryRows = [
    { indicador: "Ordens recebidas", valor: received.length },
    { indicador: "Montagens concluídas", valor: completed },
    { indicador: "Cumprimento da meta mensal", valor: formatPercent(goalPercent(completed, monthlyGoal?.target ?? null)) },
    { indicador: "Atrasadas em aberto", valor: late.length },
    { indicador: "Aguardando lentes", valor: waiting.length },
    { indicador: "Tempo médio até a conclusão", valor: formatHours(averageLeadHours(production, start, end)) },
    { indicador: "OS com ocorrência", valor: formatPercent(rate.percent) },
  ];

  return (
    <div>
      <PageHeading title="Relatórios" description="A produção usa a data em que a montagem foi concluída, não a data de entrada nem a de entrega.">
        <DownloadCsv filename={`relatorio-${from}-${to}.csv`} rows={summaryRows} />
        <PrintButton />
      </PageHeading>
      <Panel className="mb-4 p-3">
        <form className="grid gap-2 md:grid-cols-6" method="get">
          <Input type="date" name="from" defaultValue={from} />
          <Input type="date" name="to" defaultValue={to} />
          <Select name="laboratory" defaultValue={filters.laboratory ?? ""}>
            <option value="">Laboratório</option>
            {catalogs.laboratories.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
          </Select>
          <Select name="seller" defaultValue={filters.seller ?? ""}>
            <option value="">Vendedor</option>
            {catalogs.sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
          </Select>
          <Select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Situação</option>
            <option value="aguardando_lentes">Aguardando lentes</option>
            <option value="pronto">Pronto</option>
            <option value="entregue">Entregue</option>
            <option value="cancelado">Cancelado</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
      </Panel>
      <div className="grid gap-3 md:grid-cols-3">
        {summaryRows.map((row) => (
          <Panel key={row.indicador} className="p-3">
            <p className="text-xs text-[#6e7c7a]">{row.indicador}</p>
            <p className="mt-1 text-xl font-semibold">{row.valor}</p>
          </Panel>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ReportTable title="Produção por laboratório" rows={byLab.map((item) => ({ Laboratorio: item.key, Concluidas: item.count }))} />
        <ReportTable title="Ocorrências por categoria" rows={byCategory.map((item) => ({ Categoria: item.key, Quantidade: item.count }))} />
        <ReportTable title="Ocorrências por etapa" rows={byStep.map((item) => ({ Etapa: item.key, Quantidade: item.count }))} />
        <ReportTable title="Ações corretivas" rows={occurrences.map((item) => ({ Situacao: item.status, Quando: formatDateTime(item.occurred_at), OS: item.order_id }))} />
      </div>
      <div className="mt-4 grid gap-3">
        <Panel className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Consumo e saídas de lentes</h2>
            <DownloadCsv filename="consumo-lentes.csv" rows={consumption.map((item) => ({ tipo: item.movement_type, quantidade: item.quantity, motivo: item.reason, quando: formatDateTime(item.created_at) }))} />
          </div>
          <SimpleList rows={consumption.slice(0, 30).map((item) => `${formatDateTime(item.created_at)} · ${item.movement_type} · ${item.quantity} · ${item.reason}`)} empty="Nenhuma saída no período." />
        </Panel>
        <Panel className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Estoque baixo</h2>
            <DownloadCsv filename="estoque-baixo.csv" rows={lowStock.map((item) => ({ codigo: item.public_code, esferico: formatDiopter(item.sphere_cents), cilindrico: formatDiopter(item.cylinder_cents), saldo: item.current_qty, minimo: item.min_qty }))} />
          </div>
          <SimpleList rows={lowStock.slice(0, 30).map((item) => `${item.public_code} · ${formatDiopter(item.sphere_cents)} / ${formatDiopter(item.cylinder_cents)} · saldo ${item.current_qty}`)} empty="Nenhum item abaixo do parâmetro." />
        </Panel>
        <Panel className="p-3">
          <h2 className="font-medium">Ordens atrasadas</h2>
          <ul className="mt-2 grid gap-1 text-sm">
            {late.slice(0, 40).map((order) => {
              const source = orders.find((item) => item.id === order.id);
              return <li key={order.id}><Link className="text-[#0e6b62] underline" href={`/laboratorio/${order.id}`}>{source ? visibleOrderNumber(source) : "OS"} · {source?.client_name}</Link></li>;
            })}
            {late.length === 0 ? <li className="text-[#6e7c7a]">Nenhuma OS atrasada.</li> : null}
          </ul>
        </Panel>
        <Panel className="p-3">
          <h2 className="font-medium">Histórico de movimentações de estoque</h2>
          <SimpleList rows={(movementsResult.data ?? []).slice(0, 40).map((item) => `${formatDateTime(item.created_at)} · ${item.movement_type} · ${item.signed_delta} · ${item.reason}`)} empty="Sem movimentações no período." />
        </Panel>
      </div>
    </div>
  );
}

function ReportTable({ title, rows }: { title: string; rows: Record<string, string | number>[] }) {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  return (
    <Panel className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        <DownloadCsv filename={`${title}.csv`} rows={rows} />
      </div>
      {rows.length === 0 ? <p className="text-sm text-[#6e7c7a]">Sem dados no período.</p> : (
        <table className="w-full text-left text-sm">
          <thead>{headers.map((header) => <th key={header} className="py-1 pr-3 text-xs uppercase text-[#6e7c7a]">{header}</th>)}</thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-[#eef1f3]">
                {headers.map((header) => <td key={header} className="py-1 pr-3">{row[header]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function SimpleList({ rows, empty }: { rows: string[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-[#6e7c7a]">{empty}</p>;
  return <ul className="grid gap-1 text-sm">{rows.map((row) => <li key={row}>{row}</li>)}</ul>;
}
