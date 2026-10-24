export type GridConfig = {
  sphereMinCents: number;
  sphereMaxCents: number;
  cylinderMinCents: number;
  cylinderMaxCents: number;
  stepCents: number;
};

export const DEFAULT_GRID: GridConfig = {
  sphereMinCents: -400,
  sphereMaxCents: 400,
  cylinderMinCents: -300,
  cylinderMaxCents: 0,
  stepCents: 25,
};

export function powerSeries(min: number, max: number, step: number) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || !Number.isInteger(step)) {
    throw new Error("Os graus da grade precisam ser múltiplos inteiros de centésimos de dioptria.");
  }
  if (step <= 0) throw new Error("O incremento da grade deve ser positivo.");
  if (min > max) throw new Error("A faixa da grade está invertida.");
  if ((min - max) % step !== 0 && (max - min) % step !== 0) {
    throw new Error("A faixa precisa fechar no incremento configurado.");
  }
  const values: number[] = [];
  for (let value = min; value <= max; value += step) values.push(value);
  return values;
}

export function isOnGrid(sphereCents: number, cylinderCents: number, grid: GridConfig) {
  const sphere = powerSeries(grid.sphereMinCents, grid.sphereMaxCents, grid.stepCents);
  const cylinder = powerSeries(grid.cylinderMinCents, grid.cylinderMaxCents, grid.stepCents);
  return sphere.includes(sphereCents) && cylinder.includes(cylinderCents);
}

export function isSpecialPower(
  sphereCents: number,
  cylinderCents: number,
  grid: GridConfig,
  markedSpecial = false,
) {
  return markedSpecial || !isOnGrid(sphereCents, cylinderCents, grid);
}

export function parseDiopterToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  const cents = Math.round(numeric * 100);
  if (Math.abs(cents / 100 - numeric) > 0.001) return null;
  return cents;
}
