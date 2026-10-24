import { describe, expect, it } from "vitest";
import { canCompleteStep, canStartStep, prontoBlockers, stepsAfterReopen } from "./assembly";
import { monthRange, weekRange } from "./calendar";
import { duplicateOrderMessage, validateOrderDraft } from "./orders";
import { can } from "./permissions";
import { powerSeries, isSpecialPower, parseDiopterToCents, DEFAULT_GRID } from "./powers";
import { averageLeadHours, countCompleted, goalPercent, isOpenLate, projectProduction } from "./production";
import { qualityRate } from "./quality";
import { isPublicCode, resolveQrScan } from "./qr";
import { applyMovement, assertConsumptionAvailable, consumptionKey, stockTone } from "./stock";
import { canTransition } from "./status";
import { orderUrgency } from "./urgency";
import type { ProductionOrder } from "./production";

const now = new Date("2026-10-19T15:00:00-03:00");

describe("ordens de serviço", () => {
  it("exige cliente, laboratório, serviço e data coerente", () => {
    const errors = validateOrderDraft({
      clientName: " ",
      laboratoryId: "",
      sellerId: null,
      enteredAt: "2026-10-19T12:00:00-03:00",
      dueAt: "2026-10-18T12:00:00-03:00",
      serviceDescription: "",
      externalOrderId: null,
      status: "pronto",
      priority: "normal",
    });
    expect(errors.length).toBeGreaterThan(3);
  });

  it("impede número e pedido externo duplicados", () => {
    const existing = [{ number: "OS-2026-000001", externalOrderId: "PED-9" }];
    expect(duplicateOrderMessage(existing, { number: "OS-2026-000001" })).toMatch(/número/);
    expect(duplicateOrderMessage(existing, { externalOrderId: "PED-9" })).toMatch(/pedido externo/);
    expect(duplicateOrderMessage(existing, { externalOrderId: "PED-10" })).toBeNull();
  });
});

describe("status", () => {
  it("segue o fluxo e o perfil", () => {
    expect(canTransition("aguardando_lentes", "em_montagem", "gestor")).toBe(false);
    expect(canTransition("aguardando_montagem", "em_montagem", "montador")).toBe(true);
    expect(canTransition("aguardando_lentes", "aguardando_montagem", "montador")).toBe(false);
    expect(canTransition("em_conferencia", "pronto", "montador")).toBe(true);
    expect(canTransition("pronto", "entregue", "montador")).toBe(false);
    expect(canTransition("pronto", "entregue", "gestor")).toBe(true);
    expect(canTransition("em_montagem", "cancelado", "consulta")).toBe(false);
  });
});

describe("urgência", () => {
  it("classifica prazo vencido, atenção, folga e situação sem prazo", () => {
    expect(
      orderUrgency({
        status: "aguardando_lentes",
        priority: "normal",
        dueAt: "2026-10-19T14:00:00-03:00",
        now,
        alertHours: 24,
      }),
    ).toBe("vermelho");
    expect(
      orderUrgency({
        status: "aguardando_montagem",
        priority: "critica",
        dueAt: "2026-10-21T14:00:00-03:00",
        now,
        alertHours: 24,
      }),
    ).toBe("vermelho");
    expect(
      orderUrgency({
        status: "em_montagem",
        priority: "normal",
        dueAt: "2026-10-20T10:00:00-03:00",
        now,
        alertHours: 24,
      }),
    ).toBe("amarelo");
    expect(
      orderUrgency({
        status: "em_montagem",
        priority: "normal",
        dueAt: "2026-10-25T10:00:00-03:00",
        now,
        alertHours: 24,
      }),
    ).toBe("verde");
    expect(
      orderUrgency({
        status: "cancelado",
        priority: "critica",
        dueAt: "2026-10-18T10:00:00-03:00",
        now,
        alertHours: 24,
      }),
    ).toBe("cinza");
    expect(
      orderUrgency({
        status: "aguardando_lentes",
        priority: "normal",
        dueAt: null,
        now,
        alertHours: 24,
      }),
    ).toBe("cinza");
  });
});

describe("produção e metas", () => {
  const orders: ProductionOrder[] = [
    {
      id: "1",
      status: "pronto",
      enteredAt: "2026-10-18T10:00:00-03:00",
      completedAt: "2026-10-19T11:00:00-03:00",
      dueAt: null,
      laboratoryId: "lab-a",
    },
    {
      id: "2",
      status: "entregue",
      enteredAt: "2026-10-01T10:00:00-03:00",
      completedAt: "2026-10-02T11:00:00-03:00",
      dueAt: null,
      laboratoryId: "lab-a",
    },
    {
      id: "3",
      status: "cancelado",
      enteredAt: "2026-10-19T08:00:00-03:00",
      completedAt: "2026-10-19T12:00:00-03:00",
      dueAt: null,
      laboratoryId: "lab-a",
    },
    {
      id: "4",
      status: "em_montagem",
      enteredAt: "2026-10-19T08:00:00-03:00",
      completedAt: null,
      dueAt: "2026-10-18T08:00:00-03:00",
      laboratoryId: "lab-a",
    },
  ];

  it("conta a conclusão efetiva e ignora criação, entrega isolada e cancelamento", () => {
    const day = countCompleted(
      orders,
      new Date("2026-10-19T00:00:00-03:00"),
      new Date("2026-10-20T00:00:00-03:00"),
      "lab-a",
    );
    expect(day).toBe(1);
    expect(
      countCompleted(
        orders,
        new Date("2026-10-01T00:00:00-03:00"),
        new Date("2026-11-01T00:00:00-03:00"),
      ),
    ).toBe(2);
  });

  it("calcula percentual e projeção sem tratar o resultado como garantia", () => {
    expect(goalPercent(8, 10)).toBeCloseTo(0.8);
    expect(goalPercent(3, null)).toBeNull();
    const month = monthRange(now);
    const projection = projectProduction({
      completed: 10,
      goal: 40,
      periodStart: month.start,
      periodEnd: month.end,
      now,
      weekdays: [1, 2, 3, 4, 5],
    });
    expect(projection.percent).toBeCloseTo(0.25);
    expect(projection.projected).not.toBeNull();
    expect(projection.note.toLowerCase()).toMatch(/não é uma garantia/);
    expect(weekRange(now).start.getTime()).toBeLessThan(now.getTime());
  });

  it("mede o tempo entre entrada e conclusão", () => {
    const hours = averageLeadHours(
      orders,
      new Date("2026-10-19T00:00:00-03:00"),
      new Date("2026-10-20T00:00:00-03:00"),
    );
    expect(hours).toBeCloseTo(25);
  });

  it("reconhece atraso independente do status aberto", () => {
    expect(isOpenLate(orders[3], now)).toBe(true);
  });
});

describe("montagem e qualidade", () => {
  const steps = [
    { key: "conferencia_inicial" as const, status: "concluida" as const },
    { key: "lensometria" as const, status: "pendente" as const },
    { key: "blocagem" as const, status: "pendente" as const },
    { key: "facetadora" as const, status: "pendente" as const },
    { key: "conferencia_qualidade" as const, status: "pendente" as const },
  ];

  it("libera a etapa seguinte e bloqueia pronto com pendência", () => {
    expect(canStartStep(steps, "lensometria")).toBe(true);
    expect(canStartStep(steps, "blocagem")).toBe(false);
    expect(canCompleteStep(steps, "lensometria")).toBe(true);
    expect(prontoBlockers({ steps, openOccurrences: 1 })).toEqual(
      expect.arrayContaining([expect.stringMatching(/ocorrência/i)]),
    );
  });

  it("reabre a etapa e as posteriores sem apagar o conceito de histórico", () => {
    const done = steps.map((step, index) => ({
      ...step,
      status: index < 3 ? ("concluida" as const) : ("pendente" as const),
    }));
    const reopened = stepsAfterReopen(done, "lensometria");
    expect(reopened.find((step) => step.key === "conferencia_inicial")?.status).toBe("concluida");
    expect(reopened.find((step) => step.key === "lensometria")?.status).toBe("pendente");
    expect(reopened.find((step) => step.key === "blocagem")?.status).toBe("pendente");
  });

  it("calcula o percentual por OS única", () => {
    const rate = qualityRate(["a", "b", "c"], ["a", "a", "z"]);
    expect(rate.affected).toBe(1);
    expect(rate.orders).toBe(3);
    expect(rate.percent).toBeCloseTo(1 / 3);
  });
});

describe("estoque", () => {
  it("entra, sai e recusa saldo negativo", () => {
    expect(applyMovement({ current: 2, type: "entrada", quantity: 3 }).next).toBe(5);
    expect(applyMovement({ current: 4, type: "saida", quantity: 4 }).next).toBe(0);
    expect(() => applyMovement({ current: 1, type: "consumo", quantity: 2 })).toThrow(/saldo/);
    expect(applyMovement({ current: 1, type: "consumo", quantity: 2, allowNegative: true }).next).toBe(-1);
    expect(applyMovement({ current: 8, type: "ajuste", quantity: 6 })).toEqual({ next: 6, delta: -2 });
  });

  it("impede consumo duplicado da mesma OS e item", () => {
    const key = consumptionKey("os", "stock");
    expect(() => assertConsumptionAvailable([key], "os", "stock")).toThrow(/já consumiu/);
    expect(assertConsumptionAvailable([], "os", "stock")).toBe(key);
  });

  it("prioriza vermelho no estoque zerado e abaixo do mínimo", () => {
    expect(stockTone(0, 0, 4)).toBe("vermelho");
    expect(stockTone(1, 3, 6)).toBe("vermelho");
    expect(stockTone(3, 3, 6)).toBe("amarelo");
    expect(stockTone(6, 3, 6)).toBe("verde");
  });

  it("separa grau especial da grade de 0,25", () => {
    const sphere = powerSeries(-400, 400, 25);
    const cylinder = powerSeries(-300, 0, 25);
    expect(sphere).toContain(-400);
    expect(sphere).toContain(25);
    expect(sphere).not.toContain(10);
    expect(cylinder[0]).toBe(-300);
    expect(isSpecialPower(-450, 0, DEFAULT_GRID)).toBe(true);
    expect(isSpecialPower(-200, -100, DEFAULT_GRID)).toBe(false);
    expect(parseDiopterToCents("-1,25")).toBe(-125);
    expect(parseDiopterToCents("+4,00")).toBe(400);
  });
});

describe("permissões e QR Code", () => {
  it("consulta não altera e estoquista não muda OS", () => {
    expect(can("consulta", "orders.write")).toBe(false);
    expect(can("consulta", "stock.write")).toBe(false);
    expect(can("estoquista", "stock.write")).toBe(true);
    expect(can("estoquista", "orders.status")).toBe(false);
    expect(can("montador", "assembly.write")).toBe(true);
    expect(can("admin", "users.manage")).toBe(true);
    expect(can("gestor", "users.manage")).toBe(false);
  });

  it("só identifica um código válido e não afirma leitura incompleta", () => {
    expect(isPublicCode("LN-AB23CD45EF")).toBe(true);
    expect(resolveQrScan("https://lab.exemplo/estoque/codigo/LN-AB23CD45EF")).toEqual({
      status: "identified",
      code: "LN-AB23CD45EF",
    });
    expect(resolveQrScan("lente -2,00").status).toBe("invalid");
    const empty = resolveQrScan("");
    expect(empty.status === "invalid" && empty.message).toMatch(/nenhum código/i);
  });
});
