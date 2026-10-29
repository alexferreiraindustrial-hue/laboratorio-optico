"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { BellRing, CheckCircle2, Clock, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { STEP_LABEL, type StepKey } from "@/lib/domain/constants";
import { BO_DECISIONS, boMessage, boStage, type BoDecision, type BoStage } from "@/lib/domain/flow";
import { visibleOrderNumber } from "@/lib/domain/orders";
import { whatsappLink } from "@/lib/domain/forecast";
import { cn } from "@/lib/utils";
import { decideOccurrence, notifyOccurrence, resolveOccurrence } from "@/server/flow-actions";
import type { BoRow } from "@/server/flow";
import { Button, Field, Input, TextArea } from "./ui";

const STAGES: { key: BoStage; title: string; hint: string; color: string }[] = [
  { key: "avisar", title: "Separado · avisar", hint: "Óculos barrado na bancada. Avise o vendedor ou o gestor.", color: "#b42318" },
  { key: "aguardando_decisao", title: "Aguardando decisão", hint: "Avisado. Esperando a resposta sobre o que fazer.", color: "#c8881a" },
  { key: "em_tratamento", title: "Em tratamento", hint: "Decisão tomada. Conclua quando o óculos voltar ao fluxo.", color: "#1e4d9b" },
];

function since(iso: string, now: number) {
  const hours = (now - new Date(iso).getTime()) / 36e5;
  if (hours < 1) return "agora há pouco";
  if (hours < 24) return `há ${Math.round(hours)} h`;
  return `há ${Math.round(hours / 24)} dias`;
}

function Card({ row, now, canManage, onDecide, onResolve }: { row: BoRow; now: number; canManage: boolean; onDecide: () => void; onResolve: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const stage = boStage(row);
  const order = row.order;
  const phone = order?.seller_whatsapp || order?.store_whatsapp || null;
  const message = boMessage({
    sellerName: order?.seller_name ?? order?.store_name,
    number: order?.number ?? "",
    externalOrderId: order?.external_order_id,
    clientName: order?.client_name ?? "cliente",
    step: row.step_key ? STEP_LABEL[row.step_key as StepKey] : null,
    category: row.category_name,
    description: row.description,
  });
  const link = whatsappLink(phone, message);
  const waitingLong = stage !== "em_tratamento" && now - new Date(row.notified_at ?? row.occurred_at).getTime() > 24 * 36e5;

  function notify(openWhatsapp: boolean) {
    if (openWhatsapp && link) window.open(link, "_blank", "noopener");
    start(async () => {
      const result = await notifyOccurrence(row.id);
      if (result.ok) {
        toast.success(openWhatsapp && link ? "WhatsApp aberto e aviso registrado." : "Aviso registrado.");
        router.refresh();
      } else toast.error(result.message);
    });
  }

  return (
    <article className={cn("flex flex-col gap-2 rounded-[10px] border bg-white p-3 shadow-[0_1px_2px_rgba(19,32,31,0.04)]", waitingLong ? "border-[#e7a39b]" : "border-[#e2e7e9]", pending && "opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <Link href={`/laboratorio/${row.order_id}`} className="font-mono text-xs font-semibold text-[#0e6b62] hover:underline">
          {order ? visibleOrderNumber(order) : "OS"}
        </Link>
        <span className={cn("flex items-center gap-1 text-[11px]", waitingLong ? "font-semibold text-[#a3261b]" : "text-[#6e7c7a]")}>
          <Clock size={12} /> {since(row.notified_at && stage === "aguardando_decisao" ? row.notified_at : row.occurred_at, now)}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold">{order?.client_name}</p>
        <p className="text-xs text-[#6e7c7a]">{[order?.seller_name, order?.store_name].filter(Boolean).join(" · ") || "Sem vendedor"}</p>
      </div>
      <div className="rounded-md bg-[#fdf3f2] px-2.5 py-2">
        <p className="text-xs font-semibold text-[#a3261b]">
          {row.category_name}
          {row.step_key ? <span className="font-normal text-[#8a5a00]"> · na {STEP_LABEL[row.step_key as StepKey].toLowerCase()}</span> : null}
        </p>
        <p className="mt-0.5 line-clamp-3 text-xs text-[#44524f]">{row.description}</p>
      </div>
      {row.decision ? (
        <p className="rounded-md bg-[#e8eefa] px-2.5 py-1.5 text-xs font-semibold text-[#1e4d9b]">
          {BO_DECISIONS[row.decision as BoDecision]?.label ?? row.decision}
          {row.decision_note ? <span className="block font-normal text-[#44524f]">{row.decision_note}</span> : null}
        </p>
      ) : null}
      {canManage ? (
        <div className="flex flex-wrap gap-1.5 border-t border-[#eef1f3] pt-2">
          {stage === "avisar" ? (
            link ? (
              <>
                <Button size="sm" onClick={() => notify(true)} disabled={pending} className="bg-[#1f9d55] hover:bg-[#188046] border-[#1f9d55]">
                  <MessageCircle size={14} /> Avisar no WhatsApp
                </Button>
                <Button size="sm" variant="ghost" onClick={() => notify(false)} disabled={pending}>
                  Já avisei
                </Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => notify(false)} disabled={pending} title="Vendedor e loja sem WhatsApp cadastrado">
                <BellRing size={14} /> Marcar como avisado
              </Button>
            )
          ) : null}
          {stage !== "em_tratamento" ? (
            <Button size="sm" variant={stage === "aguardando_decisao" ? "default" : "secondary"} onClick={onDecide} disabled={pending}>
              Registrar decisão
            </Button>
          ) : (
            <Button size="sm" onClick={onResolve} disabled={pending}>
              <CheckCircle2 size={14} /> Concluir BO
            </Button>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function BoBoard({ rows, canManage, canCancel, nowMs }: { rows: BoRow[]; canManage: boolean; canCancel: boolean; nowMs: number }) {
  const router = useRouter();
  const [deciding, setDeciding] = useState<BoRow | null>(null);
  const [resolving, setResolving] = useState<BoRow | null>(null);
  const [decision, setDecision] = useState<BoDecision>("nova_lente");
  const [note, setNote] = useState("");
  const [lensDate, setLensDate] = useState("");
  const [pending, start] = useTransition();

  function submitDecision() {
    if (!deciding) return;
    start(async () => {
      const result = await decideOccurrence(deciding.id, decision, note, decision === "nova_lente" ? lensDate || null : null);
      if (result.ok) {
        toast.success(result.message);
        setDeciding(null);
        router.refresh();
      } else toast.error(result.message);
    });
  }

  function submitResolve() {
    if (!resolving) return;
    start(async () => {
      const result = await resolveOccurrence(resolving.id, note);
      if (result.ok) {
        toast.success(result.message);
        setResolving(null);
        router.refresh();
      } else toast.error(result.message);
    });
  }

  return (
    <>
      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const list = rows.filter((row) => boStage(row) === stage.key);
          return (
            <section key={stage.key} className="flex min-h-72 w-[300px] shrink-0 flex-col gap-2 rounded-xl bg-[#e9edef] p-2.5 lg:w-auto lg:flex-1">
              <header className="flex items-center gap-2 px-1 pb-1 pt-0.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <h2 className="text-[13px] font-semibold">{stage.title}</h2>
                  <span className="text-[11px] text-[#6e7c7a]">{stage.hint}</span>
                </div>
                <span className="font-mono text-xs text-[#6e7c7a]">{list.length}</span>
              </header>
              {list.map((row) => (
                <Card
                  key={row.id}
                  row={row}
                  now={nowMs}
                  canManage={canManage}
                  onDecide={() => {
                    setDecision("nova_lente");
                    setNote("");
                    setLensDate("");
                    setDeciding(row);
                  }}
                  onResolve={() => {
                    setNote("");
                    setResolving(row);
                  }}
                />
              ))}
              {list.length === 0 ? <div className="rounded-[10px] border border-dashed border-[#cdd5d8] px-3 py-5 text-center text-xs text-[#8a9694]">Nada aqui</div> : null}
            </section>
          );
        })}
      </div>

      <Dialog.Root open={deciding !== null} onOpenChange={(open) => !open && setDeciding(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[#13201f]/35 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl bg-white p-5 shadow-2xl outline-none data-[state=open]:animate-[pagein_.18s_ease-out]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-lg font-semibold">Decisão sobre o óculos</Dialog.Title>
                <Dialog.Description className="text-[13px] text-[#6e7c7a]">
                  {deciding?.order?.client_name} · {deciding?.category_name}
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded-md p-1.5 text-[#44524f] hover:bg-[#f2f4f5]" aria-label="Fechar">
                <X size={18} />
              </Dialog.Close>
            </div>
            <div className="grid gap-2">
              {(Object.keys(BO_DECISIONS) as BoDecision[])
                .filter((key) => key !== "cancelar" || canCancel)
                .map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDecision(key)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      decision === key ? "border-[#0e6b62] bg-[#e4f1ef]" : "border-[#e2e7e9] hover:bg-[#f7f9f9]",
                    )}
                  >
                    <span className="text-sm font-semibold">{BO_DECISIONS[key].label}</span>
                    <span className="text-xs text-[#6e7c7a]">{BO_DECISIONS[key].hint}</span>
                  </button>
                ))}
            </div>
            {decision === "nova_lente" ? (
              <Field label="Previsão da nova lente (laboratório externo)" hint="A OS volta para Lentes a chegar com essa data.">
                <Input type="date" value={lensDate} onChange={(event) => setLensDate(event.target.value)} />
              </Field>
            ) : null}
            <Field label="Quem decidiu / observação">
              <TextArea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-16" placeholder="Ex.: Ana pediu nova lente, cliente avisado" maxLength={500} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeciding(null)}>
                Voltar
              </Button>
              <Button onClick={submitDecision} disabled={pending}>
                {pending ? "Salvando…" : "Registrar decisão"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={resolving !== null} onOpenChange={(open) => !open && setResolving(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[#13201f]/35 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl bg-white p-5 shadow-2xl outline-none">
            <Dialog.Title className="text-lg font-semibold">Concluir assistência</Dialog.Title>
            <Dialog.Description className="text-[13px] text-[#6e7c7a]">
              O óculos de {resolving?.order?.client_name} volta ao fluxo normal. A ocorrência fica registrada para a análise mensal (Pareto por etapa).
            </Dialog.Description>
            <Field label="Como foi resolvido">
              <TextArea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-16" maxLength={500} placeholder="Ex.: nova lente montada e conferida" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setResolving(null)}>
                Voltar
              </Button>
              <Button onClick={submitResolve} disabled={pending}>
                {pending ? "Salvando…" : "Concluir BO"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
