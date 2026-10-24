import { describe, expect, it } from "vitest";
import {
  firstPassYield,
  fiveSLevel,
  fiveSTotal,
  flowMetrics,
  inverseNormal,
  kaizenPriority,
  littleLeadTimeDays,
  nextKaizenStatus,
  pareto,
  senseScore,
  sigmaLevel,
  stepCycleTimes,
  taktMinutes,
  uChart,
  wipState,
} from "./lean";

describe("Six Sigma", () => {
  it("inversa da normal bate com valores de tabela", () => {
    expect(inverseNormal(0.5)).toBeCloseTo(0, 6);
    expect(inverseNormal(0.975)).toBeCloseTo(1.959964, 5);
    expect(inverseNormal(0.01)).toBeCloseTo(-2.326348, 5);
  });

  it("3,4 DPMO corresponde a 6 sigma e 66.807 DPMO a 3 sigma", () => {
    expect(sigmaLevel(34, 2_000_000, 5).sigma).toBeCloseTo(6, 1);
    const three = sigmaLevel(66807, 200_000, 5);
    expect(three.dpmo).toBe(66807);
    expect(three.sigma).toBeCloseTo(3, 1);
  });

  it("sem defeitos é 6 sigma e sem unidades não calcula", () => {
    expect(sigmaLevel(0, 10).sigma).toBe(6);
    expect(sigmaLevel(3, 0).sigma).toBeNull();
  });

  it("FPY considera só OS concluídas", () => {
    expect(firstPassYield(["a", "b", "c", "d"], ["a", "x"])).toBe(0.75);
    expect(firstPassYield([], ["a"])).toBeNull();
  });
});

describe("Fluxo", () => {
  const order = (id: string, enteredH: number, doneH: number | null, dueH: number | null) => ({
    id,
    entered_at: new Date(Date.UTC(2026, 9, 1) + enteredH * 36e5).toISOString(),
    completed_at: doneH === null ? null : new Date(Date.UTC(2026, 9, 1) + doneH * 36e5).toISOString(),
    due_at: dueH === null ? null : new Date(Date.UTC(2026, 9, 1) + dueH * 36e5).toISOString(),
  });

  it("calcula lead time e entrega no prazo", () => {
    const result = flowMetrics([order("a", 0, 10, 12), order("b", 0, 30, 24), order("c", 0, 20, null), order("d", 0, null, 5)]);
    expect(result.completed).toBe(3);
    expect(result.leadTimeMeanH).toBe(20);
    expect(result.leadTimeMedianH).toBe(20);
    expect(result.otd).toBe(0.5);
  });

  it("Lei de Little e takt", () => {
    expect(littleLeadTimeDays(30, 10)).toBe(3);
    expect(littleLeadTimeDays(5, 0)).toBeNull();
    expect(taktMinutes(480, 24)).toBe(20);
  });

  it("identifica o gargalo pela etapa mais lenta", () => {
    const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1) + minutes * 60000).toISOString();
    const result = stepCycleTimes([
      { step_key: "blocagem", started_at: at(0), completed_at: at(5) },
      { step_key: "facetadora", started_at: at(0), completed_at: at(14) },
      { step_key: "facetadora", started_at: at(0), completed_at: at(10) },
      { step_key: "lensometria", started_at: at(0), completed_at: at(9999) },
    ]);
    expect(result.bottleneck).toBe("facetadora");
    expect(result.rows.find((row) => row.key === "facetadora")?.minutes).toBe(12);
    expect(result.rows.find((row) => row.key === "lensometria")?.minutes).toBeNull();
  });
});

describe("Pareto e carta de controle", () => {
  it("marca os poucos vitais até 80%", () => {
    const items = pareto(["A", "A", "A", "A", "A", "B", "B", "B", "C", "D"]);
    expect(items.map((item) => item.name)).toEqual(["A", "B", "C", "D"]);
    expect(items.map((item) => item.vital)).toEqual([true, true, false, false]);
    expect(items[1].cumulative).toBeCloseTo(0.8);
  });

  it("carta u aponta ponto fora de controle", () => {
    const days = Array.from({ length: 10 }, (_, index) => ({ label: `d${index}`, defects: 1, units: 10 }));
    days.push({ label: "pico", defects: 9, units: 10 });
    const chart = uChart(days);
    expect(chart.center).toBeCloseTo(19 / 110);
    expect(chart.points.find((point) => point.label === "pico")?.out).toBe(true);
    expect(chart.points.filter((point) => point.out)).toHaveLength(1);
  });
});

describe("5S, Kaizen e WIP", () => {
  it("converte checklist em nota de 0 a 5", () => {
    expect(senseScore([2, 2, 2, 2])).toBe(5);
    expect(senseScore([0, 0, 0, 0])).toBe(0);
    expect(senseScore([2, 1, 1, 0])).toBe(2.5);
  });

  it("média e nível 5S", () => {
    const total = fiveSTotal({ seiri: 5, seiton: 4, seiso: 4, seiketsu: 3, shitsuke: 4 });
    expect(total.average).toBe(4);
    expect(fiveSLevel(total.percent).label).toBe("Bom");
    expect(fiveSLevel(0.3).label).toBe("Crítico");
  });

  it("prioriza ganho rápido e avança o PDCA", () => {
    expect(kaizenPriority(3, 1).label).toBe("Ganho rápido");
    expect(nextKaizenStatus("ideia")).toBe("em_teste");
    expect(nextKaizenStatus("padronizada")).toBeNull();
  });

  it("estado do limite WIP", () => {
    expect(wipState(3, 0)).toBe("livre");
    expect(wipState(3, 4)).toBe("ok");
    expect(wipState(4, 4)).toBe("no_limite");
    expect(wipState(5, 4)).toBe("estourado");
  });
});
