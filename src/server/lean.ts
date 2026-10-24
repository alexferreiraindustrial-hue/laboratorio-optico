import { addDays, zonedStart, zonedYmd } from "@/lib/domain/calendar";
import { QUEUE_STATUSES } from "@/lib/domain/constants";
import {
  FIVE_S_KEYS,
  firstPassYield,
  fiveSTotal,
  flowMetrics,
  littleLeadTimeDays,
  pareto,
  sigmaLevel,
  stepCycleTimes,
  taktMinutes,
  uChart,
  type FiveSScores,
  type KaizenCategory,
  type KaizenStatus,
  type LeanSettings,
} from "@/lib/domain/lean";
import { loadCatalogs } from "./queries";
import { requireProfile } from "./session";

export type KaizenIdea = {
  id: string;
  code: number;
  title: string;
  problem: string;
  proposal: string;
  area: string;
  category: KaizenCategory;
  status: KaizenStatus;
  impact: number;
  effort: number;
  whys: string[];
  root_cause: string | null;
  result: string | null;
  gain_minutes_day: number | null;
  owner_id: string | null;
  created_by: string | null;
  started_at: string | null;
  standardized_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FiveSAudit = FiveSScores & {
  id: string;
  area: string;
  audited_at: string;
  auditor_id: string | null;
  answers: Record<string, number[]>;
  notes: string | null;
};

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>, max = 5000) {
  const rows: T[] = [];
  for (let offset = 0; offset < max; offset += 1000) {
    const { data } = await build(offset, offset + 999);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function loadPeople() {
  const { supabase } = await requireProfile();
  const { data } = await supabase.from("profiles").select("id, full_name, role, active").order("full_name");
  return (data ?? []) as { id: string; full_name: string; role: string; active: boolean }[];
}

export async function loadKaizen() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase
    .from("kaizen_ideas")
    .select("id, code, title, problem, proposal, area, category, status, impact, effort, whys, root_cause, result, gain_minutes_day, owner_id, created_by, started_at, standardized_at, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);
  return { ideas: (data ?? []) as KaizenIdea[], error: error?.message ?? null };
}

export async function loadAudits() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase
    .from("five_s_audits")
    .select("id, area, audited_at, auditor_id, answers, notes, " + FIVE_S_KEYS.join(", "))
    .order("audited_at", { ascending: false })
    .limit(400);
  const audits = ((data ?? []) as unknown as FiveSAudit[]).map((audit) => ({
    ...audit,
    ...Object.fromEntries(FIVE_S_KEYS.map((key) => [key, Number(audit[key])])),
  })) as FiveSAudit[];
  return { audits, error: error?.message ?? null };
}

/** Última auditoria por área + evolução. */
export function summarizeAudits(audits: FiveSAudit[]) {
  const byArea = new Map<string, FiveSAudit[]>();
  for (const audit of audits) byArea.set(audit.area, [...(byArea.get(audit.area) ?? []), audit]);
  const areas = [...byArea.entries()].map(([area, list]) => {
    const sorted = [...list].sort((a, b) => b.audited_at.localeCompare(a.audited_at));
    const last = sorted[0];
    const previous = sorted[1] ?? null;
    const total = fiveSTotal(last);
    return {
      area,
      last,
      previous,
      percent: total.percent,
      delta: previous ? total.percent - fiveSTotal(previous).percent : null,
      history: sorted
        .slice(0, 12)
        .reverse()
        .map((audit) => ({ at: audit.audited_at, percent: fiveSTotal(audit).percent })),
    };
  });
  areas.sort((a, b) => a.area.localeCompare(b.area, "pt-BR"));
  const overall = areas.length ? areas.reduce((sum, area) => sum + area.percent, 0) / areas.length : null;
  return { areas, overall };
}

export type LeanMetrics = Awaited<ReturnType<typeof loadLeanMetrics>>;

export async function loadLeanMetrics(days = 30) {
  const { supabase } = await requireProfile();
  const now = new Date();
  const todayYmd = zonedYmd(now);
  const startYmd = addDays(todayYmd, -(days - 1));
  const from = zonedStart(startYmd).toISOString();

  const [catalogs, completed, entered, occurrences, steps, wipResult, categories] = await Promise.all([
    loadCatalogs(),
    fetchAll<{ id: string; entered_at: string; due_at: string | null; completed_at: string | null }>((a, b) =>
      supabase.from("service_orders").select("id, entered_at, due_at, completed_at").gte("completed_at", from).neq("status", "cancelado").range(a, b),
    ),
    supabase.from("service_orders").select("id", { count: "exact", head: true }).gte("entered_at", from).neq("status", "cancelado"),
    fetchAll<{ id: string; order_id: string; category_id: string; step_key: string | null; occurred_at: string; status: string }>((a, b) =>
      supabase.from("quality_occurrences").select("id, order_id, category_id, step_key, occurred_at, status").gte("occurred_at", from).neq("status", "dispensada").range(a, b),
    ),
    fetchAll<{ step_key: string; started_at: string | null; completed_at: string | null }>((a, b) =>
      supabase.from("assembly_steps").select("step_key, started_at, completed_at").eq("status", "concluida").gte("completed_at", from).range(a, b),
    ),
    supabase.from("service_orders").select("status").in("status", QUEUE_STATUSES),
    supabase.from("quality_categories").select("id, name"),
  ]);

  const settings = (catalogs.settings.lean ?? {}) as LeanSettings;
  const categoryName = new Map((categories.data ?? []).map((row) => [row.id as string, row.name as string]));
  const flow = flowMetrics(completed);
  const units = Math.max(completed.length, entered.count ?? 0);
  const sigma = sigmaLevel(occurrences.length, units);
  const fpy = firstPassYield(
    completed.map((order) => order.id),
    occurrences.map((item) => item.order_id),
  );

  // Dias úteis com produção (exclui domingos) para throughput.
  const dayKeys: string[] = [];
  for (let ymd = startYmd; ymd <= todayYmd; ymd = addDays(ymd, 1)) dayKeys.push(ymd);
  const doneByDay = new Map<string, number>();
  for (const order of completed) {
    const key = zonedYmd(new Date(order.completed_at!));
    doneByDay.set(key, (doneByDay.get(key) ?? 0) + 1);
  }
  const defectsByDay = new Map<string, number>();
  for (const item of occurrences) {
    const key = zonedYmd(new Date(item.occurred_at));
    defectsByDay.set(key, (defectsByDay.get(key) ?? 0) + 1);
  }
  const workingDays = dayKeys.filter((ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay() !== 0);
  const activeDays = workingDays.filter((ymd) => (doneByDay.get(ymd) ?? 0) > 0).length || workingDays.length || 1;
  const throughput = completed.length / activeDays;
  const wip = (wipResult.data ?? []).filter((row) => row.status !== "pronto").length;
  const wipByStatus = Object.fromEntries(QUEUE_STATUSES.map((status) => [status, 0])) as Record<string, number>;
  for (const row of wipResult.data ?? []) wipByStatus[row.status as string] = (wipByStatus[row.status as string] ?? 0) + 1;
  const demandPerDay = (entered.count ?? 0) / (workingDays.length || 1);
  const available = settings.available_minutes_per_day ?? 480;

  const chart = uChart(
    workingDays.map((ymd) => ({
      label: `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`,
      defects: defectsByDay.get(ymd) ?? 0,
      units: doneByDay.get(ymd) ?? 0,
    })),
  );

  return {
    days,
    from: startYmd,
    entered: entered.count ?? 0,
    defects: occurrences.length,
    openDefects: occurrences.filter((item) => item.status === "aberta" || item.status === "em_tratamento").length,
    fpy,
    ...sigma,
    ...flow,
    throughput,
    wip,
    wipByStatus,
    littleDays: littleLeadTimeDays(wip, throughput),
    demandPerDay,
    takt: taktMinutes(available, demandPerDay),
    availableMinutes: available,
    pareto: pareto(occurrences.map((item) => categoryName.get(item.category_id) ?? "Sem categoria")),
    chart,
    cycle: stepCycleTimes(steps),
    settings,
    trend: workingDays.map((ymd) => ({ label: `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`, done: doneByDay.get(ymd) ?? 0, defects: defectsByDay.get(ymd) ?? 0 })),
  };
}
