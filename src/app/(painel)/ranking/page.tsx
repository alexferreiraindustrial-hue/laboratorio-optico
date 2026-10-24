import { RankingBoard } from "@/components/ranking-board";
import { dayRange, monthRange, weekRange } from "@/lib/domain/calendar";
import { can } from "@/lib/domain/permissions";
import {
  rankAssemblers,
  rankByOrders,
  type RankBoard,
  type RankBoardKey,
  type RankingSettings,
  type RankPeriod,
} from "@/lib/domain/ranking";
import { loadCatalogs } from "@/server/queries";
import { requireProfile } from "@/server/session";

const PERIODS: RankPeriod[] = ["hoje", "semana", "mes"];
const BOARDS: RankBoardKey[] = ["montadores", "vendedores", "lojas"];

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; quadro?: string; tv?: string }>;
}) {
  const params = await searchParams;
  const period: RankPeriod = PERIODS.includes(params.periodo as RankPeriod) ? (params.periodo as RankPeriod) : "mes";
  const board: RankBoardKey = BOARDS.includes(params.quadro as RankBoardKey) ? (params.quadro as RankBoardKey) : "montadores";
  const { supabase, role } = await requireProfile();
  const now = new Date();
  const range = period === "hoje" ? dayRange(now) : period === "semana" ? weekRange(now) : monthRange(now);
  const from = range.start.toISOString();
  const to = range.end.toISOString();

  const [catalogs, stepsResult, occurrencesResult, ordersResult, peopleResult] = await Promise.all([
    loadCatalogs(),
    supabase
      .from("assembly_steps")
      .select("order_id, step_key, assignee_id, completed_at")
      .eq("status", "concluida")
      .gte("completed_at", from)
      .lt("completed_at", to),
    supabase.from("quality_occurrences").select("order_id, step_key, status").gte("occurred_at", from).lt("occurred_at", to),
    supabase
      .from("service_orders")
      .select("id, due_at, seller_id, store_id, status, completed_at")
      .gte("entered_at", from)
      .lt("entered_at", to),
    supabase.from("profiles").select("id, full_name, role, active"),
  ]);

  const steps = stepsResult.data ?? [];
  const stepOrderIds = [...new Set(steps.map((step) => step.order_id as string))];
  const dueByOrder = new Map<string, string | null>();
  for (let index = 0; index < stepOrderIds.length; index += 150) {
    const { data } = await supabase.from("service_orders").select("id, due_at").in("id", stepOrderIds.slice(index, index + 150));
    for (const row of data ?? []) dueByOrder.set(row.id as string, row.due_at as string | null);
  }

  const settings = (catalogs.settings.ranking ?? {}) as RankingSettings;
  const goal = (key: RankBoardKey) => settings.metas?.[key]?.[period] ?? null;
  const assemblers = (peopleResult.data ?? [])
    .filter((person) => person.active && person.role === "montador")
    .map((person) => ({ id: person.id as string, name: person.full_name as string }));
  const everyone = (peopleResult.data ?? []).map((person) => ({ id: person.id as string, name: person.full_name as string }));
  const occurrences = (occurrencesResult.data ?? []).filter((item) => item.status !== "dispensada");

  const montadores = rankAssemblers({
    people: assemblers,
    steps: steps as never,
    occurrences: occurrences as never,
    dueByOrder,
    goal: goal("montadores"),
  }).map((entry) => (entry.name === "Sem nome" ? { ...entry, name: everyone.find((p) => p.id === entry.id)?.name ?? entry.name } : entry));

  const orders = (ordersResult.data ?? []) as never;
  const boards: RankBoard[] = [
    { key: "montadores", label: "Montadores", scoreLabel: "pontos", doneLabel: "montagens", entries: montadores },
    {
      key: "vendedores",
      label: "Vendedores",
      scoreLabel: "OS",
      doneLabel: "OS",
      entries: rankByOrders({
        subjects: catalogs.sellers.filter((seller) => seller.active).map((seller) => ({ id: seller.id, name: seller.name })),
        orders,
        field: "seller_id",
        goal: goal("vendedores"),
        now,
      }),
    },
    {
      key: "lojas",
      label: "Lojas",
      scoreLabel: "OS",
      doneLabel: "OS",
      entries: rankByOrders({
        subjects: catalogs.stores.filter((store) => store.active).map((store) => ({ id: store.id, name: store.trade_name })),
        orders,
        field: "store_id",
        goal: goal("lojas"),
        now,
      }),
    },
  ];

  return (
    <RankingBoard
      boards={boards}
      board={board}
      period={period}
      settings={settings}
      canEdit={can(role, "settings.write")}
      startTv={params.tv === "1"}
      updatedAt={now.toISOString()}
    />
  );
}
