import type { OrderStatus } from "./constants";
import { addDays, countWorkingDays, eachYmd, zonedStart, zonedYmd } from "./calendar";

export type ProductionOrder = {
  id: string;
  status: OrderStatus;
  enteredAt: string | null;
  completedAt: string | null;
  dueAt: string | null;
  laboratoryId: string | null;
  sellerId?: string | null;
};

export function isCompletedProduction(order: ProductionOrder) {
  if (!order.completedAt) return false;
  return order.status === "pronto" || order.status === "entregue";
}

export function inRange(iso: string, start: Date, end: Date) {
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time < end.getTime();
}

export function countCompleted(
  orders: ProductionOrder[],
  start: Date,
  end: Date,
  laboratoryId?: string | null,
) {
  return orders.filter(
    (order) =>
      isCompletedProduction(order) &&
      inRange(order.completedAt!, start, end) &&
      (!laboratoryId || order.laboratoryId === laboratoryId),
  ).length;
}

export function goalPercent(completed: number, goal: number | null) {
  if (goal == null || goal <= 0) return null;
  return completed / goal;
}

export function projectProduction(input: {
  completed: number;
  goal: number | null;
  periodStart: Date;
  periodEnd: Date;
  now: Date;
  weekdays: number[];
}) {
  const { completed, goal, periodStart, periodEnd, now, weekdays } = input;
  const totalWorkingDays = countWorkingDays(periodStart, periodEnd, weekdays);
  const elapsedEnd = now < periodStart ? periodStart : now > periodEnd ? periodEnd : now;
  const elapsedWorkingDays = countWorkingDays(periodStart, elapsedEnd, weekdays);
  const remainingWorkingDays = Math.max(0, totalWorkingDays - elapsedWorkingDays);
  const percent = goalPercent(completed, goal);
  const closed = now >= periodEnd;
  const notStarted = now < periodStart;

  if (notStarted || elapsedWorkingDays === 0) {
    return {
      percent,
      totalWorkingDays,
      elapsedWorkingDays,
      remainingWorkingDays,
      dailyAverage: null as number | null,
      projected: null as number | null,
      note: "Ainda não há dias de funcionamento decorridos neste período para estimar a produção.",
    };
  }

  const dailyAverage = completed / elapsedWorkingDays;
  const projected = closed ? completed : completed + dailyAverage * remainingWorkingDays;
  return {
    percent,
    totalWorkingDays,
    elapsedWorkingDays,
    remainingWorkingDays,
    dailyAverage,
    projected,
    note: "Projeção estimada pela média diária nos dias de funcionamento já decorridos. Não é uma garantia.",
  };
}

export function dailySeries(
  orders: ProductionOrder[],
  start: Date,
  end: Date,
  dailyGoal: number | null,
  laboratoryId?: string | null,
) {
  const startYmd = zonedYmd(start);
  const endYmd = zonedYmd(new Date(end.getTime() - 1));
  return eachYmd(startYmd, addDays(endYmd, 1)).map((day) => ({
    day,
    produced: countCompleted(
      orders,
      zonedStart(day),
      zonedStart(addDays(day, 1)),
      laboratoryId,
    ),
    goal: dailyGoal,
  }));
}

export function averageLeadHours(orders: ProductionOrder[], start: Date, end: Date) {
  const samples = orders.filter(
    (order) =>
      isCompletedProduction(order) &&
      order.enteredAt &&
      inRange(order.completedAt!, start, end),
  );
  if (samples.length === 0) return null;
  const total = samples.reduce((sum, order) => {
    return sum + (new Date(order.completedAt!).getTime() - new Date(order.enteredAt!).getTime());
  }, 0);
  return total / samples.length / 36e5;
}

export function isOpenLate(order: ProductionOrder, now: Date) {
  if (!order.dueAt) return false;
  if (order.status === "entregue" || order.status === "cancelado") return false;
  return new Date(order.dueAt).getTime() < now.getTime();
}
