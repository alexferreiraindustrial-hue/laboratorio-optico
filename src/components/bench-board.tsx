"use client";

import { Check, LayoutList, Play, ScanLine, Search, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { RiskChip } from "@/components/forecast-ui";
import { LensGauge } from "@/components/lens";
import { Feedback } from "@/components/ui";
import { canCompleteStep, canStartStep } from "@/lib/domain/assembly";
import { STEP_KEYS, STEP_LABEL, type AppRole, type OrderStatus, type StepKey, type StepStatus } from "@/lib/domain/constants";
import { forecastOrder, formatHoursShort } from "@/lib/domain/forecast";
import { can } from "@/lib/domain/permissions";
import { canTransition } from "@/lib/domain/status";
import { cn } from "@/lib/utils";
import { advanceStep, changeOrderStatus } from "@/server/actions";

export type BenchOrder = {
  id: string;
  number: string;
  clientName: string;
  sellerName: string | null;
  storeName: string | null;
  externalOrderId: string | null;
  dueAt: string | null;
  status: Extract<OrderStatus, "aguardando_montagem" | "em_montagem" | "em_correcao" | "em_conferencia">;
  urgent: boolean;
  steps: { key: StepKey; status: StepStatus; startedAt: string | null; assignee: string | null }[];
};

const SHORT: Record<StepKey, string> = {
  conferencia_inicial: "Conferência",
  lensometria: "Lensometria",
  blocagem: "Blocagem",
  facetadora: "Facetadora",
  conferencia_qualidade: "Qualidade",
};

const LANES: { key: string; title: string; hint: string; statuses: BenchOrder["status"][] }[] = [
  { key: "agora", title: "Na bancada agora", hint: "Em montagem ou voltando de correção", statuses: ["em_correcao", "em_montagem"] },
  { key: "conferencia", title: "Conferência de qualidade", hint: "Última checagem antes de ficar pronta", statuses: ["em_conferencia"] },
  { key: "proximas", title: "Próximas", hint: "Lentes na bancada, esperando um montador", statuses: ["aguardando_montagem"] },
];

type NextAction =
  | { kind: "status"; to: OrderStatus; label: string; note: string }
  | { kind: "step"; action: "iniciar" | "concluir"; step: StepKey; label: string }
  | { kind: "none"; label: string };

function nextAction(order: BenchOrder, role: AppRole): NextAction {
  if (order.status === "aguardando_montagem") {
    return canTransition(order.status, "em_montagem", role)
      ? { kind: "status", to: "em_montagem", label: "Começar montagem", note: "Início pela bancada" }
      : { kind: "none", label: "Aguardando montador" };
  }
  if (!can(role, "assembly.write")) return { kind: "none", label: "Somente consulta" };
  const snapshots = order.steps.map((step) => ({ key: step.key, status: step.status }));
  for (const key of STEP_KEYS) {
    const step = order.steps.find((item) => item.key === key);
    if (!step || step.status === "concluida") continue;
    if (step.status === "em_andamento" && canCompleteStep(snapshots, key)) {
      return { kind: "step", action: "concluir", step: key, label: `Concluir ${STEP_LABEL[key].toLowerCase()}` };
    }
    if (canStartStep(snapshots, key)) {
      return { kind: "step", action: "iniciar", step: key, label: `Iniciar ${STEP_LABEL[key].toLowerCase()}` };
    }
    return { kind: "none", label: `${STEP_LABEL[key]} bloqueada` };
  }
  if (order.status === "em_conferencia" && canTransition(order.status, "pronto", role)) {
    return { kind: "status", to: "pronto", label: "Marcar como pronta", note: "Conferida na bancada" };
  }
  if (order.status === "em_montagem" && canTransition(order.status, "em_conferencia", role)) {
    return { kind: "status", to: "em_conferencia", label: "Enviar para conferência", note: "Etapas concluídas" };
  }
  return { kind: "none", label: "Sem ação pendente" };
}

function timeOf(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

export function BenchBoard({ orders, role, error, nowIso }: { orders: BenchOrder[]; role: AppRole; error: string | null; nowIso: string }) {
  const [query, setQuery] = useState("");
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) =>
      [order.number, order.clientName, order.externalOrderId, order.sellerName, order.storeName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [orders, query]);

  const lateCount = orders.filter((order) => {
    const forecast = forecastOrder({ status: order.status, dueAt: order.dueAt, stepsDone: order.steps.filter((s) => s.status === "concluida").length, now });
    return forecast.risk === "atrasada" || forecast.risk === "risco";
  }).length;

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">Bancada de montagem</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#6e7c7a]">
            Cada cartão mostra a próxima ação da OS. Um toque registra a etapa com o seu nome e o horário.
            {lateCount > 0 ? (
              <strong className="font-semibold text-[#a3261b]">
                {lateCount === 1 ? " 1 OS em risco de atraso: comece por ela." : ` ${lateCount} OS em risco de atraso: comece por elas.`}
              </strong>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-[#cdd5d8] bg-white px-3 focus-within:border-[#0e6b62] focus-within:ring-[3px] focus-within:ring-[#0e6b62]/20 sm:w-80">
            <ScanLine size={18} className="text-[#6e7c7a]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Bipe ou digite a OS / cliente"
              aria-label="Encontrar OS na bancada"
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] shadow-none outline-none focus:shadow-none"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="text-xs font-semibold text-[#0e6b62]">
                Limpar
              </button>
            ) : (
              <Search size={16} className="text-[#8a9694]" />
            )}
          </label>
          <Link
            href="/montagem?view=lista"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#cdd5d8] bg-white px-3.5 text-sm font-medium text-[#13201f] hover:bg-[#f7f9f9]"
          >
            <LayoutList size={16} />
            Ver em lista
          </Link>
        </div>
      </div>

      {error ? <Feedback error={error} /> : null}

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {LANES.map((lane) => {
          const items = filtered.filter((order) => lane.statuses.includes(order.status));
          return (
            <section key={lane.key} className="grid gap-3 rounded-2xl bg-[#e3ebeb]/70 p-3">
              <header className="flex items-baseline justify-between gap-2 px-1">
                <div>
                  <h2 className="text-[15px] font-semibold">{lane.title}</h2>
                  <p className="text-xs text-[#6e7c7a]">{lane.hint}</p>
                </div>
                <span className="tabular rounded-lg bg-white px-2 py-0.5 text-sm font-bold text-[#0a4f48]">{items.length}</span>
              </header>
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#c5d1d2] px-4 py-8 text-center text-sm text-[#6e7c7a]">
                  {query ? "Nenhuma OS encontrada aqui." : lane.key === "proximas" ? "Nada esperando. Libere lentes no Lançamento rápido." : "Nenhuma OS nesta etapa."}
                </p>
              ) : (
                items.map((order) => <BenchCard key={order.id} order={order} role={role} now={now} />)
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BenchCard({ order, role, now }: { order: BenchOrder; role: AppRole; now: Date }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const stepsDone = order.steps.filter((step) => step.status === "concluida").length;
  const forecast = forecastOrder({ status: order.status, dueAt: order.dueAt, stepsDone, now });
  const action = nextAction(order, role);
  const running = order.steps.find((step) => step.status === "em_andamento");
  const late = forecast.risk === "atrasada" || forecast.risk === "risco";

  function run() {
    if (action.kind === "none") return;
    setError(null);
    startTransition(async () => {
      let result;
      if (action.kind === "status") {
        result = await changeOrderStatus(order.id, action.to, action.note);
      } else {
        const data = new FormData();
        data.set("orderId", order.id);
        data.set("stepKey", action.step);
        data.set("action", action.action);
        result = await advanceStep(data);
      }
      if (!result.ok) setError(result.message ?? "Não foi possível registrar.");
      else router.refresh();
    });
  }

  return (
    <article
      className={cn(
        "grid gap-3 rounded-xl border bg-white p-3.5 shadow-[0_1px_0_rgba(19,32,31,0.04)]",
        late ? "border-[#f1c4be]" : "border-[#dfe6e7]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/montagem/${order.id}`} className="font-mono text-[13px] font-semibold text-[#0e6b62] hover:underline">
              {order.number}
            </Link>
            {order.externalOrderId ? <span className="text-xs text-[#6e7c7a]">ótica {order.externalOrderId}</span> : null}
            {order.urgent ? <span className="rounded-md bg-[#fdecea] px-1.5 py-px text-[11px] font-bold text-[#a3261b]">Urgente</span> : null}
            {order.status === "em_correcao" ? (
              <span className="rounded-md bg-[#fdecea] px-1.5 py-px text-[11px] font-bold text-[#a3261b]">Em correção</span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[17px] font-semibold leading-snug">{order.clientName}</p>
          <p className="truncate text-xs text-[#6e7c7a]">{[order.storeName, order.sellerName].filter(Boolean).join(" · ") || "Sem loja ou vendedor"}</p>
        </div>
        <LensGauge value={forecast.progress} risk={forecast.risk} size={62} />
      </div>

      <ol className="grid grid-cols-5 gap-1" aria-label="Etapas da montagem">
        {STEP_KEYS.map((key) => {
          const step = order.steps.find((item) => item.key === key);
          const status = step?.status ?? "pendente";
          return (
            <li key={key} className="grid gap-1" title={`${STEP_LABEL[key]}: ${status.replace("_", " ")}`}>
              <span
                className={cn(
                  "h-1.5 rounded-full",
                  status === "concluida" && "bg-[#0e6b62]",
                  status === "em_andamento" && "bg-[repeating-linear-gradient(135deg,#3fb58f_0_5px,#8fdcc1_5px_10px)]",
                  status === "reprovada" && "bg-[#d2382b]",
                  status === "pendente" && "bg-[#dfe6e7]",
                )}
              />
              <span
                className={cn(
                  "truncate text-[10.5px] leading-none",
                  status === "em_andamento" ? "font-bold text-[#0a4f48]" : status === "concluida" ? "text-[#44524f]" : "text-[#8a9694]",
                )}
              >
                {SHORT[key]}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6e7c7a]">
        <span className="min-w-0 truncate">
          {running ? (
            <>
              <Wrench size={12} className="mr-1 inline align-[-1px]" />
              {STEP_LABEL[running.key]} desde {timeOf(running.startedAt)}
              {running.assignee ? ` com ${running.assignee.split(" ")[0]}` : ""}
            </>
          ) : forecast.slackHours !== null && forecast.risk !== "pronta" ? (
            forecast.slackHours >= 0 ? (
              `Folga de ${formatHoursShort(forecast.slackHours)} no prazo`
            ) : (
              `Passou ${formatHoursShort(-forecast.slackHours)} da previsão`
            )
          ) : (
            "Sem prazo definido"
          )}
        </span>
        {forecast.risk === "atencao" || late ? <RiskChip risk={forecast.risk} /> : null}
      </div>

      {action.kind === "none" ? (
        <p className="rounded-lg bg-[#f2f5f5] px-3 py-2.5 text-center text-sm font-medium text-[#6e7c7a]">{action.label}</p>
      ) : (
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0e6b62]/30 disabled:opacity-60",
            action.kind === "status" && action.to === "pronto"
              ? "bg-[#1f8a52] hover:bg-[#18723f]"
              : action.kind === "step" && action.action === "concluir"
                ? "bg-[#0b5850] hover:bg-[#08463f]"
                : "bg-[#0e6b62] hover:bg-[#0b5850]",
          )}
        >
          {action.kind === "step" && action.action === "concluir" ? <Check size={18} /> : <Play size={16} />}
          {pending ? "Registrando..." : action.label}
        </button>
      )}
      {error ? <Feedback error={error} /> : null}
    </article>
  );
}
