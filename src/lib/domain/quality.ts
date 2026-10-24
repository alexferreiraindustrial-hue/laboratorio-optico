export function qualityRate(orderIdsInPeriod: string[], occurrenceOrderIds: string[]) {
  const universe = new Set(orderIdsInPeriod);
  const affected = new Set(
    occurrenceOrderIds.filter((orderId) => universe.has(orderId)),
  );
  return {
    orders: universe.size,
    affected: affected.size,
    percent: universe.size === 0 ? null : affected.size / universe.size,
  };
}

export function countByKey(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "pt-BR"));
}
