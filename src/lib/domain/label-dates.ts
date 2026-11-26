// Compara a data prevista do serviço com a previsão que o laboratório informou para a lente.

export type ForecastCompare = { tone: "ok" | "risco" | "falta"; label: string };

export function compareForecast(dueAt: string | null | undefined, labAt: string | null | undefined): ForecastCompare {
  if (!labAt) return { tone: "falta", label: "Laboratório ainda sem previsão" };
  if (!dueAt) return { tone: "ok", label: "Serviço sem data prevista" };
  const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
  const due = day(dueAt), lab = day(labAt);
  if (lab > due) {
    const diff = Math.round((Date.parse(`${lab}T12:00:00Z`) - Date.parse(`${due}T12:00:00Z`)) / 864e5);
    return { tone: "risco", label: `Lente chega ${diff} dia${diff > 1 ? "s" : ""} depois do prazo` };
  }
  if (lab === due) return { tone: "risco", label: "Lente chega no dia do prazo" };
  return { tone: "ok", label: "Lente chega antes do prazo" };
}

/** dd/mm (fuso de São Paulo); vazio quando não há data. */
export function shortDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso));
}
