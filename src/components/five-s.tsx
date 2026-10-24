"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ClipboardCheck, TrendingDown, TrendingUp, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { FIVE_S, FIVE_S_KEYS, fiveSLevel, fiveSTotal, senseScore, type FiveSKey } from "@/lib/domain/lean";
import { cn } from "@/lib/utils";
import { saveFiveSAudit } from "@/server/lean-actions";
import type { FiveSAudit } from "@/server/lean";
import { FiveSRadar, Spark } from "./lean-charts";
import { Button, Field, Input, TextArea } from "./ui";

type AreaSummary = {
  area: string;
  last: FiveSAudit;
  percent: number;
  delta: number | null;
  history: { at: string; percent: number }[];
  previous: FiveSAudit | null;
};

const SENSE_COLOR: Record<FiveSKey, string> = {
  seiri: "#0e6b62",
  seiton: "#1e4d9b",
  seiso: "#c8881a",
  seiketsu: "#5a3d86",
  shitsuke: "#1c6b43",
};

const ANSWERS = [
  { value: 0, label: "Não", cls: "bg-[#b42318] text-white" },
  { value: 1, label: "Parcial", cls: "bg-[#d99a0b] text-white" },
  { value: 2, label: "Sim", cls: "bg-[#1c6b43] text-white" },
];

const pct = (value: number) => `${Math.round(value * 100)}%`;

function levelClass(percent: number) {
  const tone = fiveSLevel(percent).tone;
  return tone === "ok" ? "bg-[#e6f4ec] text-[#1c6b43]" : tone === "warn" ? "bg-[#fdf3dc] text-[#8a5a00]" : "bg-[#fdecea] text-[#a3261b]";
}

function AuditForm({ areas, onDone, initialArea }: { areas: string[]; onDone: () => void; initialArea?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const scores = Object.fromEntries(FIVE_S.map((sense) => [sense.key, senseScore(sense.questions.map((_, index) => answers[`${sense.key}_${index}`] ?? 0))])) as Record<FiveSKey, number>;
  const total = fiveSTotal(scores);
  const answered = Object.keys(answers).length;
  const totalQuestions = FIVE_S.reduce((sum, sense) => sum + sense.questions.length, 0);
  const sense = FIVE_S[step];

  function submit(formData: FormData) {
    if (answered < totalQuestions) {
      toast.error(`Responda todas as perguntas (${answered}/${totalQuestions}).`);
      return;
    }
    start(async () => {
      const result = await saveFiveSAudit(formData);
      if (result.ok) {
        toast.success(`${result.message} Nota geral ${pct(total.percent)}.`);
        onDone();
        router.refresh();
      } else toast.error(result.message);
    });
  }

  return (
    <form action={submit} className="flex h-full flex-col">
      {Object.entries(answers).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <div className="grid gap-3 border-b border-[#eef1f3] px-5 py-4">
        <Field label="Área auditada">
          <Input name="area" list="five-s-areas" required defaultValue={initialArea ?? areas[0] ?? "Bancada de montagem"} />
        </Field>
        <datalist id="five-s-areas">
          {areas.map((area) => (
            <option key={area} value={area} />
          ))}
        </datalist>
        <div className="grid grid-cols-5 gap-1.5">
          {FIVE_S.map((item, index) => {
            const done = item.questions.every((_, q) => answers[`${item.key}_${q}`] !== undefined);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setStep(index)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-colors",
                  index === step ? "border-transparent text-white" : "border-[#e2e7e9] bg-white text-[#44524f] hover:bg-[#f7f9f9]",
                )}
                style={index === step ? { background: SENSE_COLOR[item.key] } : undefined}
              >
                <span className="text-xs font-bold">{index + 1}S</span>
                <span className="text-[10px] font-medium opacity-90">{item.jp}</span>
                <span className={cn("tabular text-[11px] font-semibold", index === step ? "text-white" : done ? "text-[#1c6b43]" : "text-[#8a9694]")}>
                  {done ? `${scores[item.key].toLocaleString("pt-BR")}/5` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-3">
          <p className="text-base font-semibold" style={{ color: SENSE_COLOR[sense.key] }}>
            {sense.jp} · {sense.pt}
          </p>
          <p className="text-[13px] text-[#6e7c7a]">{sense.hint}</p>
        </div>
        <ul className="grid gap-2.5">
          {sense.questions.map((question, index) => {
            const key = `${sense.key}_${index}`;
            return (
              <li key={key} className="rounded-xl border border-[#e2e7e9] p-3">
                <p className="text-sm font-medium">{question}</p>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {ANSWERS.map((answer) => (
                    <button
                      key={answer.value}
                      type="button"
                      onClick={() => {
                        setAnswers((current) => ({ ...current, [key]: answer.value }));
                        const last = index === sense.questions.length - 1;
                        const complete = sense.questions.every((_, q) => q === index || answers[`${sense.key}_${q}`] !== undefined);
                        if (last && complete && step < FIVE_S.length - 1) setTimeout(() => setStep((value) => value + 1), 180);
                      }}
                      className={cn(
                        "rounded-lg border py-2 text-sm font-semibold transition-all",
                        answers[key] === answer.value ? `${answer.cls} border-transparent shadow-sm` : "border-[#e2e7e9] bg-white text-[#44524f] hover:bg-[#f7f9f9]",
                      )}
                    >
                      {answer.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        {step === FIVE_S.length - 1 ? (
          <div className="mt-4">
            <Field label="Observações e pendências">
              <TextArea name="notes" maxLength={2000} className="min-h-20" placeholder="O que precisa ser corrigido até a próxima auditoria?" />
            </Field>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#e2e7e9] px-5 py-3">
        <div className="flex flex-col leading-tight">
          <span className="text-xs text-[#6e7c7a]">
            {answered}/{totalQuestions} respostas
          </span>
          <span className="tabular text-lg font-semibold">
            {pct(total.percent)} <span className={cn("rounded px-1.5 py-px align-middle text-[11px] font-semibold", levelClass(total.percent))}>{fiveSLevel(total.percent).label}</span>
          </span>
        </div>
        <div className="flex gap-2">
          {step > 0 ? (
            <Button type="button" variant="secondary" onClick={() => setStep((value) => value - 1)}>
              Voltar
            </Button>
          ) : null}
          {step < FIVE_S.length - 1 ? (
            <Button type="button" onClick={() => setStep((value) => value + 1)}>
              Próximo senso
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Concluir auditoria"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

export function FiveSPanel({ areas, audits, canWrite }: { areas: AreaSummary[]; audits: FiveSAudit[]; canWrite: boolean }) {
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState(areas[0]?.area ?? "");
  const [open, setOpen] = useState(searchParams.get("nova") === "1" && canWrite);
  const current = areas.find((area) => area.area === selected) ?? areas[0];
  const areaNames = useMemo(
    () => [...new Set([...areas.map((area) => area.area), "Bancada de montagem", "Facetadora", "Estoque de lentes", "Conferência de qualidade"])],
    [areas],
  );

  return (
    <div className="grid gap-5 animate-[pagein_.35s_ease-out]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FIVE_S.map((sense, index) => (
            <span key={sense.key} className="flex items-center gap-1.5 rounded-lg border border-[#e2e7e9] bg-white px-2.5 py-1 text-xs" title={sense.hint}>
              <span className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold text-white" style={{ background: SENSE_COLOR[sense.key] }}>
                {index + 1}
              </span>
              <span className="font-semibold">{sense.jp}</span>
              <span className="text-[#6e7c7a]">{sense.pt}</span>
            </span>
          ))}
        </div>
        {canWrite ? (
          <Button onClick={() => setOpen(true)}>
            <ClipboardCheck size={16} /> Nova auditoria
          </Button>
        ) : null}
      </div>

      {areas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#cdd5d8] bg-white px-4 py-12 text-center">
          <p className="font-semibold">Nenhuma auditoria 5S ainda</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#6e7c7a]">Comece pela bancada de montagem: 20 perguntas rápidas, respondidas no posto de trabalho com a equipe.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {areas.map((area) => (
              <button
                key={area.area}
                type="button"
                onClick={() => setSelected(area.area)}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-18px_rgba(14,107,98,0.6)]",
                  current?.area === area.area ? "border-[#0e6b62] ring-[3px] ring-[#0e6b62]/15" : "border-[#e2e7e9]",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{area.area}</span>
                  <span className={cn("shrink-0 rounded px-1.5 py-px text-[11px] font-semibold", levelClass(area.percent))}>{fiveSLevel(area.percent).label}</span>
                </span>
                <span className="flex items-end justify-between gap-2">
                  <span className="tabular text-[28px] font-semibold leading-none tracking-[-0.02em]">{pct(area.percent)}</span>
                  <Spark values={area.history.map((point) => point.percent)} />
                </span>
                <span className="flex items-center gap-1 text-xs text-[#6e7c7a]">
                  {area.delta == null ? (
                    "Primeira auditoria"
                  ) : area.delta >= 0 ? (
                    <>
                      <TrendingUp size={14} className="text-[#1c6b43]" /> +{Math.round(area.delta * 100)} p.p. desde a anterior
                    </>
                  ) : (
                    <>
                      <TrendingDown size={14} className="text-[#b42318]" /> {Math.round(area.delta * 100)} p.p. desde a anterior
                    </>
                  )}
                </span>
                <span className="flex gap-1">
                  {FIVE_S_KEYS.map((key) => (
                    <span key={key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef1f3]" title={`${key}: ${area.last[key]}/5`}>
                      <span className="block h-full rounded-full" style={{ width: `${(area.last[key] / 5) * 100}%`, background: SENSE_COLOR[key] }} />
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>

          {current ? (
            <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
              <section className="rounded-xl border border-[#e2e7e9] bg-white p-5">
                <h2 className="text-[15px] font-semibold">Radar 5S · {current.area}</h2>
                <p className="text-xs text-[#6e7c7a]">Última auditoria comparada à anterior. Quanto maior a área, mais maduro o posto.</p>
                <FiveSRadar
                  series={[
                    ...(current.previous ? [{ name: "Anterior", color: "#9fb3b0", values: current.previous as unknown as Record<string, number> }] : []),
                    { name: "Atual", color: "#0e6b62", values: current.last as unknown as Record<string, number> },
                  ]}
                />
              </section>
              <section className="rounded-xl border border-[#e2e7e9] bg-white p-5">
                <h2 className="text-[15px] font-semibold">Nota por senso</h2>
                <p className="mb-3 text-xs text-[#6e7c7a]">
                  Auditoria de {new Date(current.last.audited_at).toLocaleDateString("pt-BR")}
                  {current.last.notes ? ` · ${current.last.notes}` : ""}
                </p>
                <ul className="grid gap-3">
                  {FIVE_S.map((sense) => {
                    const value = current.last[sense.key];
                    const weakest = sense.questions
                      .map((question, index) => ({ question, answer: current.last.answers?.[sense.key]?.[index] }))
                      .filter((item) => item.answer !== undefined && item.answer < 2);
                    return (
                      <li key={sense.key}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold">
                            {sense.jp} <span className="font-normal text-[#6e7c7a]">· {sense.pt}</span>
                          </span>
                          <span className="tabular font-semibold">{value.toLocaleString("pt-BR")}/5</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#eef1f3]">
                          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(value / 5) * 100}%`, background: SENSE_COLOR[sense.key] }} />
                        </div>
                        {weakest.length ? (
                          <p className="mt-1 text-xs text-[#8a5a00]">
                            Pendência: {weakest[0].question.toLowerCase()}
                            {weakest.length > 1 ? ` (+${weakest.length - 1})` : ""}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-[#e2e7e9] bg-white">
            <h2 className="border-b border-[#eef1f3] px-5 py-3.5 text-[15px] font-semibold">Histórico de auditorias</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-[#f7f9f9] text-xs text-[#6e7c7a]">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Data</th>
                    <th className="px-3 py-2 text-left font-medium">Área</th>
                    {FIVE_S.map((sense) => (
                      <th key={sense.key} className="px-2 py-2 text-center font-medium">
                        {sense.jp}
                      </th>
                    ))}
                    <th className="px-5 py-2 text-right font-medium">Índice</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.slice(0, 16).map((audit) => {
                    const total = fiveSTotal(audit).percent;
                    return (
                      <tr key={audit.id} className="border-t border-[#eef1f3]">
                        <td className="tabular px-5 py-2 text-[#44524f]">{new Date(audit.audited_at).toLocaleDateString("pt-BR")}</td>
                        <td className="px-3 py-2 font-medium">{audit.area}</td>
                        {FIVE_S_KEYS.map((key) => (
                          <td key={key} className="tabular px-2 py-2 text-center">
                            {audit[key].toLocaleString("pt-BR")}
                          </td>
                        ))}
                        <td className="px-5 py-2 text-right">
                          <span className={cn("tabular rounded px-1.5 py-0.5 text-xs font-semibold", levelClass(total))}>{pct(total)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[#13201f]/35 backdrop-blur-[2px] data-[state=open]:animate-[fadein_.15s_ease-out]" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl outline-none data-[state=open]:animate-[slidein_.22s_cubic-bezier(.2,.8,.2,1)]">
            <div className="flex items-start justify-between gap-3 border-b border-[#e2e7e9] px-5 py-4">
              <div>
                <Dialog.Title className="flex items-center gap-2 text-lg font-semibold">
                  <ClipboardCheck size={18} className="text-[#0e6b62]" /> Auditoria 5S
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-[13px] text-[#6e7c7a]">Faça no posto de trabalho (Gemba), junto com quem trabalha nele.</Dialog.Description>
              </div>
              <Dialog.Close className="rounded-md p-1.5 text-[#44524f] hover:bg-[#f2f4f5]" aria-label="Fechar">
                <X size={18} />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1">{open ? <AuditForm areas={areaNames} initialArea={current?.area} onDone={() => setOpen(false)} /> : null}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
