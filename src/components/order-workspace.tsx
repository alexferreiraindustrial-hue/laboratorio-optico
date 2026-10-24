"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { OrderActions } from "@/components/order-actions";
import { StatusBadge, UrgencyMark } from "@/components/status-badge";
import { Button, Feedback, Field, Input, Panel, Select, TextArea } from "@/components/ui";
import { STATUS_LABEL, STEP_KEYS, STEP_LABEL, STEP_STATUS_LABEL, type AppRole, type OrderStatus, type StepKey } from "@/lib/domain/constants";
import { can } from "@/lib/domain/permissions";
import { canCompleteStep, canStartStep, prontoBlockers } from "@/lib/domain/assembly";
import { dueDeltaLabel } from "@/lib/domain/urgency";
import { safeStoragePath, validateAttachment } from "@/lib/domain/files";
import { formatDateTime, formatDiopter } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { LensSpec, OccurrenceRow, OrderRow, StepRow, StockRow } from "@/lib/types";
import { advanceStep, moveStock, removeAttachment, saveOccurrence, updateOccurrence } from "@/server/actions";
import type { OrderMessage } from "@/server/order-detail";
import { replyMessage } from "@/server/parties";
import { isReadOnly } from "@/lib/domain/permissions";
import { JOURNEY, forecastOrder, formatForecastDate, journeyIndex, sellerUpdateMessage, whatsappLink } from "@/lib/domain/forecast";
import { NotifySeller, RiskChip } from "./forecast-ui";
import { LensGauge } from "./lens";
import { cn } from "@/lib/utils";

type HistoryItem = { id: string; from_status: string | null; to_status: string; note: string | null; created_at: string; user_name?: string };
type AttachmentItem = { id: string; entity_type: string; entity_id: string; storage_path: string; file_name: string; mime_type: string; url?: string };
type MovementItem = { id: string; movement_type: string; quantity: number; signed_delta: number; reason: string; created_at: string; public_code?: string };

export function OrderWorkspace({
  order,
  steps,
  history,
  occurrences,
  categories,
  attachments,
  movements,
  role,
  mode,
  seller = null,
  messages = [],
}: {
  seller?: { id: string; name: string; phone: string | null; whatsapp: string | null } | null;
  messages?: OrderMessage[];
  order: OrderRow;
  steps: StepRow[];
  history: HistoryItem[];
  occurrences: OccurrenceRow[];
  categories: { id: string; name: string }[];
  attachments: AttachmentItem[];
  movements: MovementItem[];
  role: AppRole;
  mode: "laboratorio" | "montagem";
}) {
  const spec = (order.lens_spec ?? {}) as LensSpec;
  const openOccurrences = occurrences.filter((item) => item.status === "aberta" || item.status === "em_tratamento").length;
  const blockers = prontoBlockers({
    steps: steps.map((step) => ({ key: step.step_key, status: step.status })),
    openOccurrences,
  });
  const orderedSteps = STEP_KEYS.map((key) => steps.find((step) => step.step_key === key)).filter(Boolean) as StepRow[];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-4">
        <Panel className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm text-[#0e6b62]">{order.number}</p>
              <h1 className="text-xl font-semibold">{order.client_name}</h1>
              <p className="mt-1 text-sm text-[#6e7c7a]">{order.service_description}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={order.status} />
              <UrgencyMark urgency={order.urgency} />
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-[#6e7c7a]">Loja</dt><dd>{order.store_name || "—"}</dd></div>
            <div><dt className="text-[#6e7c7a]">Laboratório</dt><dd>{order.laboratory_name}</dd></div>
            <div><dt className="text-[#6e7c7a]">Vendedor</dt><dd>{order.seller_name || "—"}</dd></div>
            <div><dt className="text-[#6e7c7a]">Entrada</dt><dd>{formatDateTime(order.entered_at)}</dd></div>
            <div><dt className="text-[#6e7c7a]">Previsão</dt><dd>{formatDateTime(order.due_at)} · {dueDeltaLabel(order.due_at, new Date(), order.status)}</dd></div>
            <div><dt className="text-[#6e7c7a]">Pedido externo</dt><dd>{order.external_order_id || "—"}</dd></div>
            <div><dt className="text-[#6e7c7a]">Conclusão da montagem</dt><dd>{formatDateTime(order.completed_at)}</dd></div>
            <div><dt className="text-[#6e7c7a]">Entrega</dt><dd>{formatDateTime(order.delivered_at)}</dd></div>
            <div><dt className="text-[#6e7c7a]">Prioridade</dt><dd>{order.priority === "critica" ? "Crítica" : "Normal"}</dd></div>
          </dl>
          {order.status === "aguardando_lentes" ? (
            <p className="mt-3 rounded-md bg-[#f8efe2] px-3 py-2 text-sm text-[#8a5a12]">
              Esta OS aguarda lentes. A montagem não está em execução.
            </p>
          ) : null}
          {order.notes ? <p className="mt-3 text-sm">{order.notes}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {mode === "laboratorio" ? (
              <Button variant="secondary" asChild><Link href={`/laboratorio/${order.id}/editar`}>Editar dados</Link></Button>
            ) : null}
            <Button variant="secondary" asChild><Link href={`/laboratorio/etiquetas?ids=${order.id}`}>Imprimir etiqueta</Link></Button>
            <Button variant="secondary" asChild><Link href={mode === "montagem" ? `/laboratorio/${order.id}` : `/montagem/${order.id}`}>
              {mode === "montagem" ? "Ver no laboratório" : "Abrir na montagem"}
            </Link></Button>
          </div>
          <div className="mt-4">
            <OrderActions orderId={order.id} status={order.status} role={role} />
            {order.status === "em_conferencia" && blockers.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-sm text-[#8a5a12]">
                {blockers.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
          </div>
        </Panel>

        <ForecastPanel order={order} steps={steps} seller={seller} messages={messages} role={role} />

        <Panel className="p-4">
          <h2 className="font-medium">Lentes e armação informadas na OS</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>OD {spec.od_sphere || "—"} {spec.od_cylinder || ""} eixo {spec.od_axis || "—"}</div>
            <div>OE {spec.oe_sphere || "—"} {spec.oe_cylinder || ""} eixo {spec.oe_axis || "—"}</div>
            <div>Adição {spec.addition || "—"}</div>
            <div>Armação {spec.frame || "—"}</div>
          </dl>
          {spec.lens_notes ? <p className="mt-2 text-sm text-[#6e7c7a]">{spec.lens_notes}</p> : null}
          <p className="mt-2 text-xs text-[#6e7c7a]">Estes dados não dão baixa no estoque. O consumo é uma operação separada.</p>
        </Panel>

        <Panel className="p-4">
          <h2 className="font-medium">Etapas de montagem</h2>
          {order.status === "aguardando_montagem" ? (
            <p className="mt-2 rounded-md bg-[#e4f1ef] px-3 py-2 text-sm text-[#0a4f48]">
              Para liberar as etapas, mova a OS para <strong>Em montagem</strong> no botão “Movimentar” acima.
            </p>
          ) : order.status === "aguardando_lentes" ? (
            <p className="mt-2 rounded-md bg-[#f8efe2] px-3 py-2 text-sm text-[#8a5a12]">
              As etapas ficam bloqueadas até as lentes chegarem.
            </p>
          ) : null}
          <div className="mt-3 grid gap-3">
            {orderedSteps.length === 0 ? <p className="text-sm text-[#6e7c7a]">As etapas são criadas com a OS. Se não aparecerem, recarregue após a abertura.</p> : null}
            {orderedSteps.map((step) => (
              <StepCard
                key={step.id}
                step={step}
                steps={orderedSteps}
                orderId={order.id}
                orderStatus={order.status}
                role={role}
                attachments={attachments.filter((item) => item.entity_id === step.id)}
              />
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <h2 className="font-medium">Ocorrências de qualidade</h2>
          <div className="mt-3 grid gap-3">
            {occurrences.length === 0 ? <p className="text-sm text-[#6e7c7a]">Nenhuma ocorrência nesta OS.</p> : null}
            {occurrences.map((item) => (
              <OccurrenceCard key={item.id} item={item} role={role} orderId={order.id} />
            ))}
          </div>
          {can(role, "quality.write") ? <OccurrenceForm orderId={order.id} categories={categories} /> : null}
        </Panel>

        <AttachmentBox
          title="Anexos da OS"
          entityType="order"
          entityId={order.id}
          orderId={order.id}
          role={role}
          attachments={attachments.filter((item) => item.entity_type === "order")}
        />
      </div>

      <div className="grid gap-4 self-start">
        <Panel className="p-4">
          <h2 className="font-medium">Histórico de status</h2>
          <ol className="mt-3 grid gap-2 text-sm">
            {history.map((item) => (
              <li key={item.id} className="border-b border-[#eef1f3] pb-2">
                <p className="font-medium">
                  {item.from_status ? `${STATUS_LABEL[item.from_status as OrderStatus] ?? item.from_status} → ` : ""}
                  {STATUS_LABEL[item.to_status as OrderStatus] ?? item.to_status}
                </p>
                <p className="text-xs text-[#6e7c7a]">{formatDateTime(item.created_at)} {item.user_name ? `· ${item.user_name}` : ""}</p>
                {item.note ? <p className="text-xs">{item.note}</p> : null}
              </li>
            ))}
          </ol>
        </Panel>
        <ConsumeBox orderId={order.id} role={role} movements={movements} />
      </div>
    </div>
  );
}

function ForecastPanel({
  order,
  steps,
  seller,
  messages,
  role,
}: {
  order: OrderRow;
  steps: StepRow[];
  seller: { id: string; name: string; phone: string | null; whatsapp: string | null } | null;
  messages: OrderMessage[];
  role: AppRole;
}) {
  const stepsDone = steps.filter((step) => step.status === "concluida").length;
  const forecast = forecastOrder({ status: order.status, dueAt: order.due_at, stepsDone });
  const current = journeyIndex(order.status);
  const message = sellerUpdateMessage({
    sellerName: seller?.name ?? order.seller_name,
    number: order.number,
    clientName: order.client_name,
    status: order.status,
    dueAt: order.due_at,
    forecast,
    externalOrderId: order.external_order_id,
  });
  const link = whatsappLink(seller?.whatsapp || seller?.phone, message);
  const pendingMessages = messages.filter((item) => item.status !== "respondido");

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e7e9] px-5 py-3.5">
        <h2 className="text-[15px] font-semibold">Previsão e comunicação</h2>
        <RiskChip risk={forecast.risk} />
      </div>
      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <LensGauge value={forecast.progress} risk={forecast.risk} size={104} label="concluído" />
            <div className="grid gap-2 text-[13px]">
              <div>
                <p className="text-[#6e7c7a]">Estimativa de pronta</p>
                <p className="text-base font-semibold">
                  {forecast.projectedReadyAt ? formatForecastDate(forecast.projectedReadyAt) : forecast.risk === "pronta" ? "Já está pronta" : "—"}
                </p>
              </div>
              <div>
                <p className="text-[#6e7c7a]">Prazo combinado</p>
                <p className="font-medium">{order.due_at ? formatForecastDate(order.due_at) : "Sem prazo"}</p>
              </div>
            </div>
          </div>
          <ol className="grid grid-cols-6 gap-1">
            {JOURNEY.map((label, index) => {
              const done = index < current || (order.status === "entregue" && index === current);
              const now = index === current && order.status !== "entregue";
              return (
                <li key={label} className="flex flex-col items-center gap-1.5 text-center">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${done ? "bg-[#0e6b62] text-white" : now ? "bg-white text-[#0e6b62] ring-2 ring-[#0e6b62]" : "bg-[#eef1f3] text-[#8a9694]"}`}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <span className={`text-[11px] leading-tight ${now ? "font-semibold text-[#13201f]" : "text-[#6e7c7a]"}`}>{label}</span>
                </li>
              );
            })}
          </ol>
          <p
            className={`rounded-lg px-3 py-2.5 text-[13px] ${forecast.risk === "risco" || forecast.risk === "atrasada" ? "bg-[#fdecea] font-medium text-[#a3261b]" : forecast.risk === "atencao" ? "bg-[#fdf3dc] text-[#8a5a00]" : "bg-[#f7f9f9] text-[#44524f]"}`}
          >
            {forecast.reason}
            {forecast.risk === "risco" ? " Priorize esta OS e avise o vendedor agora." : ""}
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:border-l lg:border-[#eef1f3] lg:pl-5">
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-medium text-[#44524f]">Vendedor</p>
            <p className="text-sm font-semibold">{seller?.name ?? order.seller_name ?? "Não informado"}</p>
            {seller && !link ? <p className="text-xs text-[#8a5a00]">Sem WhatsApp no cadastro do vendedor — copie a mensagem.</p> : null}
          </div>
          {!isReadOnly(role) && (seller || order.seller_name) ? (
            <>
              <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded-lg bg-[#f7f9f9] px-3 py-2.5 font-sans text-xs text-[#44524f]">{message}</pre>
              <NotifySeller message={message} link={link} sellerName={seller?.name ?? order.seller_name} />
            </>
          ) : null}
          <div className="mt-1 flex items-center justify-between">
            <p className="text-[13px] font-medium text-[#44524f]">
              Recados desta OS {pendingMessages.length > 0 ? <span className="ml-1 rounded-md bg-[#fdecea] px-1.5 text-xs font-semibold text-[#a3261b]">{pendingMessages.length} sem resposta</span> : null}
            </p>
            <Link href="/recados" className="text-xs font-semibold text-[#0e6b62] hover:underline">Todos os recados</Link>
          </div>
          {messages.length === 0 ? (
            <p className="text-xs text-[#8a9694]">Nenhum recado do vendedor ou da loja nesta OS.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {messages.slice(-4).map((item) => (
                <MessageItem key={item.id} item={item} canReply={can(role, "messages.reply")} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

function MessageItem({ item, canReply }: { item: OrderMessage; canReply: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <li className="rounded-lg border border-[#eef1f3] px-3 py-2.5 text-[13px]">
      <p className="text-[11px] text-[#6e7c7a]">{item.sender_label} · {formatDateTime(item.created_at)}</p>
      <p className="mt-0.5 whitespace-pre-wrap">{item.body}</p>
      {item.reply_body ? (
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-[#e4f1ef] px-2.5 py-1.5 text-[#0a4f48]">
          <span className="font-semibold">Laboratório:</span> {item.reply_body}
        </p>
      ) : canReply ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            formData.set("id", item.id);
            startTransition(async () => {
              const result = await replyMessage(formData);
              if (!result.ok) setError(result.message);
              else {
                setError(null);
                form.reset();
                router.refresh();
              }
            });
          }}
        >
          <input name="reply" required maxLength={800} placeholder="Responder ao vendedor" className="h-8 min-w-0 flex-1 rounded-md border border-[#cdd5d8] px-2.5 text-[13px] outline-none focus:border-[#0e6b62]" />
          <Button type="submit" size="sm" disabled={pending}>{pending ? "..." : "Responder"}</Button>
        </form>
      ) : null}
      <Feedback error={error} />
    </li>
  );
}

function StepCard({
  step,
  steps,
  orderId,
  orderStatus,
  role,
  attachments,
}: {
  step: StepRow;
  steps: StepRow[];
  orderId: string;
  orderStatus: OrderRow["status"];
  role: AppRole;
  attachments: AttachmentItem[];
}) {
  const snapshots = steps.map((item) => ({ key: item.step_key, status: item.status }));
  const executable = ["em_montagem", "em_correcao", "em_conferencia"].includes(orderStatus);
  const startOk = executable && canStartStep(snapshots, step.step_key);
  const completeOk = executable && canCompleteStep(snapshots, step.step_key);
  const position = STEP_KEYS.indexOf(step.step_key) + 1;
  const isActive = step.status === "em_andamento" || step.status === "reprovada" || startOk;

  if (step.status === "concluida") {
    return (
      <details className="group rounded-lg border border-[#dfe9e7] bg-[#f6faf9]">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#0e6b62] text-xs font-bold text-white">✓</span>
          <span className="flex-1 font-medium">{STEP_LABEL[step.step_key]}</span>
          <span className="text-xs text-[#6e7c7a]">Concluída {formatDateTime(step.completed_at)}</span>
          <span className="text-xs font-semibold text-[#0e6b62] group-open:hidden">Detalhes</span>
        </summary>
        <div className="border-t border-[#dfe9e7] px-3 pb-3">
          {step.notes ? <p className="mt-2 text-sm">{step.notes}</p> : null}
          {can(role, "assembly.write") ? (
            <StepForm orderId={orderId} stepKey={step.step_key} canStart={false} canComplete={false} canReopen />
          ) : null}
          <AttachmentBox title="Fotos da etapa" entityType="step" entityId={step.id} orderId={orderId} role={role} attachments={attachments} compact />
        </div>
      </details>
    );
  }

  if (!isActive) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-[#d5dde0] px-3 py-2.5 text-[#8a9694]">
        <span className="grid h-6 w-6 place-items-center rounded-full border border-[#cdd5d8] text-xs font-bold">{position}</span>
        <span className="flex-1 font-medium">{STEP_LABEL[step.step_key]}</span>
        <span className="text-xs">{executable ? "Aguarda a etapa anterior" : "Bloqueada até a montagem começar"}</span>
      </div>
    );
  }

  return (
    <article className="rounded-xl border-2 border-[#0e6b62] bg-white p-3.5 shadow-[0_6px_18px_-12px_rgba(14,107,98,0.6)]">
      <div className="flex items-center gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e4f1ef] text-sm font-bold text-[#0a4f48] ring-2 ring-[#0e6b62]">{position}</span>
        <h3 className="flex-1 text-[15px] font-semibold">{STEP_LABEL[step.step_key]}</h3>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-semibold",
            step.status === "reprovada" ? "bg-[#fdecea] text-[#a3261b]" : step.status === "em_andamento" ? "bg-[#e4f1ef] text-[#0a4f48]" : "bg-[#eef1f3] text-[#44524f]",
          )}
        >
          {step.status === "pendente" ? "Próxima etapa" : STEP_STATUS_LABEL[step.status]}
        </span>
      </div>
      {step.started_at ? <p className="mt-1.5 text-xs text-[#6e7c7a]">Iniciada {formatDateTime(step.started_at)}</p> : null}
      {step.notes ? <p className="mt-2 text-sm">{step.notes}</p> : null}
      {can(role, "assembly.write") ? (
        <StepForm orderId={orderId} stepKey={step.step_key} canStart={startOk} canComplete={completeOk} canReopen={false} />
      ) : null}
      <AttachmentBox title="Fotos da etapa" entityType="step" entityId={step.id} orderId={orderId} role={role} attachments={attachments} compact />
    </article>
  );
}

function StepForm({
  orderId,
  stepKey,
  canStart,
  canComplete,
  canReopen,
}: {
  orderId: string;
  stepKey: StepKey;
  canStart: boolean;
  canComplete: boolean;
  canReopen: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(action: string, form: HTMLFormElement) {
    const formData = new FormData(form);
    formData.set("action", action);
    formData.set("orderId", orderId);
    formData.set("stepKey", stepKey);
    startTransition(async () => {
      const result = await advanceStep(formData);
      if (!result.ok) {
        setMessage(null);
        setError(result.message);
        return;
      }
      setError(null);
      setMessage(result.message ?? "Etapa registrada.");
      form.reset();
      router.refresh();
    });
  }

  return (
    <form className="mt-3 grid gap-2" onSubmit={(event) => event.preventDefault()}>
      <TextArea name="notes" placeholder="Registro da etapa" />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input name="conferido" placeholder="Valor conferido" />
        <Input name="divergencia" placeholder="Divergência, se houver" />
      </div>
      <Input name="reason" placeholder="Motivo, obrigatório para reprovar ou reabrir" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={!canStart || pending} onClick={(event) => submit("iniciar", event.currentTarget.form!)}>Iniciar</Button>
        <Button type="button" disabled={!canComplete || pending} onClick={(event) => submit("concluir", event.currentTarget.form!)}>Concluir</Button>
        <Button type="button" variant="danger" disabled={pending} onClick={(event) => submit("reprovar", event.currentTarget.form!)}>Reprovar</Button>
        <Button type="button" variant="secondary" disabled={!canReopen || pending} onClick={(event) => submit("reabrir", event.currentTarget.form!)}>Devolver para correção</Button>
      </div>
      <Feedback error={error} message={message} />
    </form>
  );
}

function OccurrenceForm({ orderId, categories }: { orderId: string; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (categories.length === 0) return <p className="mt-3 text-sm">Cadastre uma categoria de defeito em Configurações.</p>;
  return (
    <form
      className="mt-4 grid gap-2 border-t border-[#eef1f3] pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = await saveOccurrence(formData);
          if (!result.ok) setError(result.message);
          else {
            setError(null);
            form.reset();
            router.refresh();
          }
        });
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <div className="grid gap-2 md:grid-cols-3">
        <Select name="categoryId" required defaultValue={categories[0]?.id}>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </Select>
        <Select name="stepKey" defaultValue="">
          <option value="">Etapa não informada</option>
          {STEP_KEYS.map((key) => <option key={key} value={key}>{STEP_LABEL[key]}</option>)}
        </Select>
        <Select name="severity" defaultValue="media">
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
          <option value="critica">Crítica</option>
        </Select>
      </div>
      <TextArea name="description" required placeholder="Descrição da ocorrência" />
      <Input name="correctiveAction" placeholder="Ação corretiva" />
      <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Registrar ocorrência"}</Button>
      <Feedback error={error} />
    </form>
  );
}

function OccurrenceCard({ item, role, orderId }: { item: OccurrenceRow; role: AppRole; orderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <article className="rounded-md border border-[#e2e7e9] p-3 text-sm">
      <div className="flex justify-between gap-2">
        <strong>{item.category_name}</strong>
        <span>{item.status}</span>
      </div>
      <p className="mt-1">{item.description}</p>
      <p className="text-xs text-[#6e7c7a]">{formatDateTime(item.occurred_at)} · {item.severity} {item.step_key ? `· ${STEP_LABEL[item.step_key]}` : ""}</p>
      {can(role, "quality.write") ? (
        <form
          className="mt-2 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await updateOccurrence(formData);
              if (!result.ok) setError(result.message);
              else router.refresh();
            });
          }}
        >
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="orderId" value={orderId} />
          <Select name="status" defaultValue={item.status}>
            <option value="aberta">Aberta</option>
            <option value="em_tratamento">Em tratamento</option>
            <option value="resolvida">Resolvida</option>
            <option value="dispensada">Dispensada</option>
          </Select>
          <Input name="correctiveAction" defaultValue={item.corrective_action ?? ""} placeholder="Ação corretiva" />
          <Input name="closingNote" defaultValue={item.closing_note ?? ""} placeholder="Observação de encerramento" />
          <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Salvando..." : "Atualizar ocorrência"}</Button>
          <Feedback error={error} />
        </form>
      ) : null}
    </article>
  );
}

function AttachmentBox({
  title,
  entityType,
  entityId,
  orderId,
  role,
  attachments,
  compact = false,
}: {
  title: string;
  entityType: "order" | "step" | "occurrence";
  entityId: string;
  orderId: string;
  role: AppRole;
  attachments: AttachmentItem[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canUpload = can(role, "orders.write") || can(role, "assembly.write") || can(role, "stock.write");

  return (
    <div className={compact ? "mt-3" : ""}>
      <Panel className={compact ? "border-0 p-0 shadow-none" : "p-4"}>
        {!compact ? <h2 className="font-medium">{title}</h2> : <p className="mt-2 text-xs font-medium text-[#6e7c7a]">{title}</p>}
        <ul className="mt-2 grid gap-2">
          {attachments.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
              {item.url ? <a className="text-[#0e6b62] underline" href={item.url} target="_blank" rel="noreferrer">{item.file_name}</a> : <span>{item.file_name}</span>}
              <button
                className="text-xs text-[#b42318]"
                type="button"
                onClick={() => {
                  startTransition(async () => {
                    const result = await removeAttachment(item.id, item.storage_path, orderId);
                    if (!result.ok) setError(result.message);
                    else router.refresh();
                  });
                }}
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
        {canUpload ? (
          <Field label={compact ? "Anexar foto ou PDF" : "Adicionar anexo"}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const invalid = validateAttachment(file);
                if (invalid) {
                  setError(invalid);
                  return;
                }
                startTransition(async () => {
                  const id = crypto.randomUUID();
                  const path = safeStoragePath(entityType, entityId, file.type, id);
                  const supabase = createClient();
                  const { data: authData } = await supabase.auth.getUser();
                  const uploaded = await supabase.storage.from("lab-files").upload(path, file, { contentType: file.type });
                  if (uploaded.error) {
                    setError(uploaded.error.message);
                    return;
                  }
                  const inserted = await supabase.from("attachments").insert({
                    id,
                    entity_type: entityType,
                    entity_id: entityId,
                    storage_path: path,
                    file_name: file.name.slice(0, 120),
                    mime_type: file.type,
                    size_bytes: file.size,
                    uploaded_by: authData.user?.id,
                  });
                  if (inserted.error) {
                    setError(inserted.error.message);
                    return;
                  }
                  setError(null);
                  router.refresh();
                });
              }}
            />
          </Field>
        ) : null}
        <Feedback error={error} />
      </Panel>
    </div>
  );
}

function ConsumeBox({ orderId, role, movements }: { orderId: string; role: AppRole; movements: MovementItem[] }) {
  const router = useRouter();
  const [results, setResults] = useState<StockRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Panel className="p-4">
      <h2 className="font-medium">Consumo de lentes</h2>
      <p className="mt-1 text-xs text-[#6e7c7a]">A baixa não acontece ao mudar o status. Cada OS consome o mesmo item uma única vez.</p>
      <ul className="mt-3 grid gap-2 text-sm">
        {movements.map((item) => (
          <li key={item.id}>
            {item.public_code} · {item.movement_type} · {item.signed_delta > 0 ? "+" : ""}{item.signed_delta} · {formatDateTime(item.created_at)}
          </li>
        ))}
        {movements.length === 0 ? <li className="text-[#6e7c7a]">Nenhum consumo registrado.</li> : null}
      </ul>
      {can(role, "stock.consume") ? (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            formData.set("type", "consumo");
            formData.set("orderId", orderId);
            startTransition(async () => {
              const result = await moveStock(formData);
              if (!result.ok) {
                setMessage(null);
                setError(result.message);
                return;
              }
              setError(null);
              setMessage(result.message ?? "Consumo registrado.");
              router.refresh();
            });
          }}
        >
          <Input
            placeholder="Buscar código LN-"
            onChange={(event) => {
              const value = event.target.value.trim();
              if (value.length < 3) return;
              const supabase = createClient();
              void supabase
                .from("lens_prescription_stock")
                .select("*")
                .ilike("public_code", `%${value.replace(/[%_]/g, "")}%`)
                .limit(6)
                .then(({ data }) => setResults((data ?? []) as StockRow[]));
            }}
          />
          <Select name="stockId" required defaultValue="">
            <option value="" disabled>Selecione a lente</option>
            {results.map((item) => (
              <option key={item.id} value={item.id}>
                {item.public_code} · {formatDiopter(item.sphere_cents)} / {formatDiopter(item.cylinder_cents)} · saldo {item.current_qty}
              </option>
            ))}
          </Select>
          <Input name="quantity" type="number" min={1} required placeholder="Quantidade" />
          <Input name="reason" required placeholder="Motivo do consumo" defaultValue="Consumo na montagem" />
          <Button type="submit" disabled={pending}>{pending ? "Registrando..." : "Registrar consumo"}</Button>
          <Feedback error={error} message={message} />
        </form>
      ) : null}
    </Panel>
  );
}
