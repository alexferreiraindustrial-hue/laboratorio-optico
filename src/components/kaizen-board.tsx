"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Grid3x3, Columns3, Lightbulb, Plus, Search, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { KAIZEN_CATEGORIES, KAIZEN_STAGES, kaizenPriority, nextKaizenStatus, type KaizenCategory, type KaizenStatus } from "@/lib/domain/lean";
import { cn } from "@/lib/utils";
import { deleteKaizen, moveKaizen, saveKaizen } from "@/server/lean-actions";
import type { KaizenIdea } from "@/server/lean";
import { Button, Field, Input, Select, TextArea } from "./ui";

type Person = { id: string; full_name: string };

const STAGE_COLOR: Record<string, string> = {
  ideia: "#0e6b62",
  em_teste: "#1e4d9b",
  verificacao: "#c8881a",
  padronizada: "#1c6b43",
  descartada: "#8a9694",
};

const CATEGORY_TONE: Record<KaizenCategory, string> = {
  qualidade: "bg-[#fdecea] text-[#a3261b]",
  fluxo: "bg-[#e8eefa] text-[#1e4d9b]",
  "5s": "bg-[#e4f1ef] text-[#0a4f48]",
  seguranca: "bg-[#fdf3dc] text-[#8a5a00]",
  custo: "bg-[#efe9f7] text-[#5a3d86]",
  ergonomia: "bg-[#eef1f3] text-[#3d4b5c]",
};

const LEVEL = ["", "Baixo", "Médio", "Alto"];

function Dots({ value, color }: { value: number; color: string }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3].map((index) => (
        <span key={index} className="h-1.5 w-1.5 rounded-full" style={{ background: index <= value ? color : "#dfe5e7" }} />
      ))}
    </span>
  );
}

function IdeaCard({ idea, people, canMove, onOpen, onAdvance }: { idea: KaizenIdea; people: Map<string, string>; canMove: boolean; onOpen: () => void; onAdvance: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: idea.id, disabled: !canMove });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const priority = kaizenPriority(idea.impact, idea.effort);
  const next = nextKaizenStatus(idea.status);
  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex flex-col gap-2 rounded-[10px] border border-[#e2e7e9] bg-white p-3 shadow-[0_1px_2px_rgba(19,32,31,0.04)] transition-[box-shadow,border-color] hover:border-[#cdd5d8] hover:shadow-[0_6px_16px_-10px_rgba(19,32,31,0.3)]",
        isDragging && "z-10 rotate-1 opacity-90 shadow-lg",
      )}
    >
      <div {...listeners} {...attributes} className={cn("flex flex-col gap-2", canMove && "cursor-grab active:cursor-grabbing")}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-medium text-[#6e7c7a]">K-{String(idea.code).padStart(3, "0")}</span>
          <span className={cn("rounded px-1.5 py-px text-[11px] font-semibold", CATEGORY_TONE[idea.category])}>{KAIZEN_CATEGORIES[idea.category]}</span>
        </div>
        <button type="button" onClick={onOpen} onPointerDown={(event) => event.stopPropagation()} className="text-left text-sm font-semibold leading-snug hover:text-[#0e6b62]">
          {idea.title}
        </button>
        <p className="line-clamp-2 text-xs text-[#6e7c7a]">{idea.problem}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6e7c7a]">
          <span className="flex items-center gap-1">
            Impacto <Dots value={idea.impact} color="#0e6b62" />
          </span>
          <span className="flex items-center gap-1">
            Esforço <Dots value={idea.effort} color="#c8881a" />
          </span>
          {idea.whys.length ? <span>{idea.whys.length}× por quê</span> : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-[#eef1f3] pt-2">
        <span className="min-w-0 truncate text-xs text-[#6e7c7a]">
          {idea.area} · {people.get(idea.owner_id ?? "") ?? "Sem responsável"}
        </span>
        {idea.status === "padronizada" && idea.gain_minutes_day ? (
          <span className="shrink-0 rounded bg-[#e6f4ec] px-1.5 py-px text-[11px] font-semibold text-[#1c6b43]">+{idea.gain_minutes_day} min/dia</span>
        ) : next && canMove ? (
          <button
            type="button"
            onClick={onAdvance}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-[#0e6b62] hover:bg-[#e4f1ef]"
            title={`Avançar para ${KAIZEN_STAGES.find((stage) => stage.key === next)?.label}`}
          >
            {KAIZEN_STAGES.find((stage) => stage.key === next)?.label} <ArrowRight size={13} />
          </button>
        ) : (
          <span className="shrink-0 text-[11px] font-semibold text-[#6e7c7a]">{priority.label}</span>
        )}
      </div>
    </article>
  );
}

function Column({ stage, children, count }: { stage: (typeof KAIZEN_STAGES)[number]; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  return (
    <div ref={setNodeRef} className={cn("flex min-h-72 w-[280px] shrink-0 flex-col gap-2 rounded-xl bg-[#e9edef] p-2.5 transition-shadow lg:w-auto lg:flex-1", isOver && "ring-2 ring-[#0e6b62]")}>
      <div className="flex items-center gap-2 px-1 pb-1 pt-0.5">
        <span className="grid h-6 w-6 place-items-center rounded-md text-xs font-bold text-white" style={{ background: STAGE_COLOR[stage.key] }}>
          {stage.pdca}
        </span>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[13px] font-semibold">{stage.label}</span>
          <span className="truncate text-[11px] text-[#6e7c7a]">{stage.hint}</span>
        </div>
        <span className="font-mono text-xs text-[#6e7c7a]">{count}</span>
      </div>
      {children}
      {count === 0 ? <div className="rounded-[10px] border border-dashed border-[#cdd5d8] px-3 py-5 text-center text-xs text-[#8a9694]">Arraste uma ideia para cá</div> : null}
    </div>
  );
}

function Segmented({ name, value, onChange, labels }: { name: string; value: number; onChange: (value: number) => void; labels: string[] }) {
  return (
    <div className="flex gap-1 rounded-lg border border-[#cdd5d8] bg-white p-0.5" role="radiogroup">
      <input type="hidden" name={name} value={value} />
      {[1, 2, 3].map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={value === level}
          onClick={() => onChange(level)}
          className={cn("flex-1 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors", value === level ? "bg-[#0e6b62] text-white" : "text-[#44524f] hover:bg-[#f2f5f5]")}
        >
          {labels[level]}
        </button>
      ))}
    </div>
  );
}

function IdeaForm({ idea, people, areas, canDelete, currentUser, onDone }: { idea: KaizenIdea | null; people: Person[]; areas: string[]; canDelete: boolean; currentUser: string; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [impact, setImpact] = useState(idea?.impact ?? 2);
  const [effort, setEffort] = useState(idea?.effort ?? 2);
  const [whys, setWhys] = useState<string[]>(() => {
    const list = [...(idea?.whys ?? [])];
    while (list.length < 5) list.push("");
    return list;
  });
  const priority = kaizenPriority(impact, effort);
  const filledWhys = whys.filter(Boolean).length;

  function submit(formData: FormData) {
    start(async () => {
      const result = await saveKaizen(formData);
      if (result.ok) {
        toast.success(result.message ?? "Salvo.");
        onDone();
        router.refresh();
      } else toast.error(result.message);
    });
  }

  function remove() {
    if (!idea) return;
    start(async () => {
      const result = await deleteKaizen(idea.id);
      if (result.ok) {
        toast.success(result.message ?? "Excluída.");
        onDone();
        router.refresh();
      } else toast.error(result.message);
    });
  }

  return (
    <form action={submit} className="grid gap-4">
      {idea ? <input type="hidden" name="id" value={idea.id} /> : null}
      <Field label="O que pode melhorar?">
        <Input name="title" required minLength={3} maxLength={140} defaultValue={idea?.title} placeholder="Ex.: Quadro de sombras para as ferramentas da bancada" />
      </Field>
      <Field label="Problema observado (Gemba)" hint="O que você viu acontecer no posto de trabalho? Fatos, não opiniões.">
        <TextArea name="problem" required minLength={3} maxLength={2000} defaultValue={idea?.problem} className="min-h-20" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Área">
          <Input name="area" list="kaizen-areas" defaultValue={idea?.area ?? "Bancada de montagem"} required />
        </Field>
        <Field label="Tipo de ganho">
          <Select name="category" defaultValue={idea?.category ?? "fluxo"}>
            {Object.entries(KAIZEN_CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <datalist id="kaizen-areas">
        {areas.map((area) => (
          <option key={area} value={area} />
        ))}
      </datalist>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Impacto">
          <Segmented name="impact" value={impact} onChange={setImpact} labels={LEVEL} />
        </Field>
        <Field label="Esforço">
          <Segmented name="effort" value={effort} onChange={setEffort} labels={LEVEL} />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-[#6e7c7a]">
        Matriz impacto × esforço: <strong className="text-[#0e6b62]">{priority.label}</strong>
      </p>

      <fieldset className="grid gap-2 rounded-xl border border-[#e2e7e9] bg-[#fafbfb] p-3">
        <legend className="px-1 text-sm font-semibold">5 Porquês · análise de causa raiz</legend>
        {whys.map((why, index) => (
          <label key={index} className="flex items-center gap-2" style={{ paddingLeft: index * 10 }}>
            <span className="w-16 shrink-0 text-xs font-semibold text-[#6e7c7a]">{index + 1}º por quê</span>
            <Input
              name="why"
              value={why}
              maxLength={200}
              placeholder={index === 0 ? "Por que o problema acontece?" : "Por que isso acontece?"}
              onChange={(event) => setWhys((current) => current.map((item, i) => (i === index ? event.target.value : item)))}
              disabled={index > 0 && !whys[index - 1]}
            />
          </label>
        ))}
        <Field label="Causa raiz" hint={filledWhys >= 3 ? "Boa análise! Escreva a causa raiz em uma frase." : "Responda pelo menos 3 porquês para chegar à causa raiz."}>
          <Input name="root_cause" maxLength={500} defaultValue={idea?.root_cause ?? ""} />
        </Field>
      </fieldset>

      <Field label="Proposta de melhoria">
        <TextArea name="proposal" maxLength={2000} defaultValue={idea?.proposal} className="min-h-20" placeholder="O que vamos testar em pequena escala?" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Responsável">
          <Select name="owner_id" defaultValue={idea?.owner_id ?? currentUser}>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ganho estimado (min/dia)" hint="Tempo de desperdício eliminado por dia">
          <Input name="gain_minutes_day" inputMode="numeric" pattern="[0-9]*" defaultValue={idea?.gain_minutes_day ?? ""} />
        </Field>
      </div>
      {idea ? (
        <Field label="Resultado medido (Verificar)">
          <TextArea name="result" maxLength={1000} defaultValue={idea.result ?? ""} className="min-h-16" placeholder="O que mudou depois do teste? Use números." />
        </Field>
      ) : null}
      <div className="flex items-center justify-between gap-2 pt-1">
        {idea && canDelete ? (
          <Button type="button" variant="ghost" onClick={remove} disabled={pending} className="text-[#b42318]">
            <Trash2 size={15} /> Excluir
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : idea ? "Salvar alterações" : "Registrar melhoria"}
        </Button>
      </div>
    </form>
  );
}

export function KaizenBoard({
  ideas,
  people,
  canWrite,
  canManage,
  currentUser,
}: {
  ideas: KaizenIdea[];
  people: Person[];
  canWrite: boolean;
  canManage: boolean;
  currentUser: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startMove] = useTransition();
  const [optimistic, applyMove] = useOptimistic(ideas, (state, move: { id: string; status: KaizenStatus }) =>
    state.map((idea) => (idea.id === move.id ? { ...idea, status: move.status } : idea)),
  );
  const [open, setOpen] = useState<"new" | string | null>(searchParams.get("nova") === "1" && canWrite ? "new" : null);
  const [view, setView] = useState<"quadro" | "matriz">("quadro");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [showDiscarded, setShowDiscarded] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const names = useMemo(() => new Map(people.map((person) => [person.id, person.full_name])), [people]);
  const areas = useMemo(() => [...new Set(["Bancada de montagem", "Lensometria", "Blocagem", "Facetadora", "Conferência de qualidade", "Estoque de lentes", ...ideas.map((idea) => idea.area)])], [ideas]);

  const filtered = optimistic.filter((idea) => {
    if (category && idea.category !== category) return false;
    const text = query.trim().toLowerCase();
    if (text && !`${idea.title} ${idea.problem} ${idea.area}`.toLowerCase().includes(text)) return false;
    return true;
  });
  const discarded = filtered.filter((idea) => idea.status === "descartada");
  const editing = open && open !== "new" ? optimistic.find((idea) => idea.id === open) ?? null : null;

  function canMoveIdea(idea: KaizenIdea) {
    return canManage || (canWrite && (idea.created_by === currentUser || idea.owner_id === currentUser));
  }

  function move(id: string, status: KaizenStatus) {
    startMove(async () => {
      applyMove({ id, status });
      const result = await moveKaizen(id, status);
      if (!result.ok) toast.error(result.message);
      else if (status === "padronizada") toast.success("Melhoria padronizada! Atualize o procedimento e o checklist 5S do posto.");
      router.refresh();
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const idea = optimistic.find((item) => item.id === event.active.id);
    const status = event.over?.id as KaizenStatus | undefined;
    if (!idea || !status || idea.status === status) return;
    move(idea.id, status);
  }

  return (
    <div className="grid gap-4 animate-[pagein_.35s_ease-out]">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e2e7e9] bg-white px-2.5 text-[#6e7c7a] sm:max-w-xs">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ideia" className="min-w-0 flex-1 bg-transparent text-sm text-[#13201f] outline-none" />
        </label>
        <Select value={category} onChange={(event) => setCategory(event.target.value)} className="w-40">
          <option value="">Todos os tipos</option>
          {Object.entries(KAIZEN_CATEGORIES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <div className="flex gap-1 rounded-lg border border-[#e2e7e9] bg-white p-0.5">
          <button type="button" onClick={() => setView("quadro")} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium", view === "quadro" ? "bg-[#e4f1ef] text-[#0a4f48]" : "text-[#44524f]")}>
            <Columns3 size={15} /> PDCA
          </button>
          <button type="button" onClick={() => setView("matriz")} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium", view === "matriz" ? "bg-[#e4f1ef] text-[#0a4f48]" : "text-[#44524f]")}>
            <Grid3x3 size={15} /> Impacto × esforço
          </button>
        </div>
        <div className="flex-1" />
        {canWrite ? (
          <Button onClick={() => setOpen("new")}>
            <Plus size={16} /> Nova ideia
          </Button>
        ) : null}
      </div>

      {view === "quadro" ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex items-start gap-3 overflow-x-auto pb-2">
            {KAIZEN_STAGES.map((stage) => {
              const list = filtered
                .filter((idea) => idea.status === stage.key)
                .sort((a, b) => kaizenPriority(a.impact, a.effort).rank - kaizenPriority(b.impact, b.effort).rank || b.updated_at.localeCompare(a.updated_at));
              return (
                <Column key={stage.key} stage={stage} count={list.length}>
                  {list.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      people={names}
                      canMove={canMoveIdea(idea)}
                      onOpen={() => setOpen(idea.id)}
                      onAdvance={() => {
                        const next = nextKaizenStatus(idea.status);
                        if (next) move(idea.id, next);
                      }}
                    />
                  ))}
                </Column>
              );
            })}
          </div>
        </DndContext>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-[72px_repeat(3,1fr)] gap-2">
            <span />
            {[1, 2, 3].map((effort) => (
              <span key={effort} className="text-center text-xs font-semibold text-[#6e7c7a]">
                Esforço {LEVEL[effort].toLowerCase()}
              </span>
            ))}
            {[3, 2, 1].map((impact) => (
              <div key={impact} className="contents">
                <span className="self-center text-right text-xs font-semibold text-[#6e7c7a]">Impacto {LEVEL[impact].toLowerCase()}</span>
                {[1, 2, 3].map((effort) => {
                  const cell = filtered.filter((idea) => idea.impact === impact && idea.effort === effort && idea.status !== "descartada" && idea.status !== "padronizada");
                  const label = kaizenPriority(impact, effort).label;
                  const strong = impact >= 2 && effort <= 2;
                  return (
                    <div key={effort} className={cn("flex min-h-28 flex-col gap-1.5 rounded-xl border p-2.5", strong ? "border-[#bcd9d4] bg-[#f0f7f6]" : "border-[#e2e7e9] bg-white")}>
                      <span className={cn("text-[11px] font-semibold uppercase tracking-wide", strong ? "text-[#0e6b62]" : "text-[#8a9694]")}>{label}</span>
                      {cell.map((idea) => (
                        <button key={idea.id} type="button" onClick={() => setOpen(idea.id)} className="truncate rounded-md bg-white px-2 py-1 text-left text-xs font-medium shadow-[0_0_0_1px_#e2e7e9] hover:shadow-[0_0_0_1px_#0e6b62]">
                          {idea.title}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {discarded.length ? (
        <div>
          <button type="button" onClick={() => setShowDiscarded((value) => !value)} className="text-[13px] font-medium text-[#6e7c7a] hover:text-[#13201f]">
            {showDiscarded ? "Ocultar" : "Ver"} {discarded.length} {discarded.length === 1 ? "ideia descartada" : "ideias descartadas"}
          </button>
          {showDiscarded ? (
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {discarded.map((idea) => (
                <li key={idea.id}>
                  <button type="button" onClick={() => setOpen(idea.id)} className="w-full rounded-lg border border-dashed border-[#cdd5d8] bg-white px-3 py-2 text-left text-sm text-[#6e7c7a] hover:border-[#8a9694]">
                    <span className="font-medium text-[#44524f]">{idea.title}</span>
                    {idea.result ? <span className="block text-xs">{idea.result}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Dialog.Root open={open !== null} onOpenChange={(value) => !value && setOpen(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[#13201f]/35 backdrop-blur-[2px] data-[state=open]:animate-[fadein_.15s_ease-out]" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl outline-none data-[state=open]:animate-[slidein_.22s_cubic-bezier(.2,.8,.2,1)]">
            <div className="flex items-start justify-between gap-3 border-b border-[#e2e7e9] px-5 py-4">
              <div>
                <Dialog.Title className="flex items-center gap-2 text-lg font-semibold">
                  <Lightbulb size={18} className="text-[#c8881a]" />
                  {editing ? `K-${String(editing.code).padStart(3, "0")} · ${editing.title}` : "Nova ideia de melhoria"}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-[13px] text-[#6e7c7a]">
                  {editing ? "Atualize a análise e o resultado. Mova pelo PDCA no quadro." : "Kaizen: pequenas melhorias, feitas por quem executa o trabalho."}
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded-md p-1.5 text-[#44524f] hover:bg-[#f2f4f5]" aria-label="Fechar">
                <X size={18} />
              </Dialog.Close>
            </div>
            {editing ? (
              <div className="flex flex-wrap gap-1.5 border-b border-[#eef1f3] px-5 py-3">
                {[...KAIZEN_STAGES.map((stage) => ({ key: stage.key as KaizenStatus, label: `${stage.pdca} · ${stage.label}` })), { key: "descartada" as KaizenStatus, label: "Descartar" }].map((stage) => (
                  <button
                    key={stage.key}
                    type="button"
                    disabled={!canMoveIdea(editing)}
                    onClick={() => move(editing.id, stage.key)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                      editing.status === stage.key ? "border-transparent text-white" : "border-[#e2e7e9] text-[#44524f] hover:bg-[#f2f5f5]",
                    )}
                    style={editing.status === stage.key ? { background: STAGE_COLOR[stage.key] } : undefined}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {open !== null && (open === "new" || editing) ? (
                <IdeaForm key={open} idea={editing} people={people} areas={areas} canDelete={canManage} currentUser={currentUser} onDone={() => setOpen(null)} />
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
