"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STEP_LABEL, type StepKey } from "@/lib/domain/constants";
import { registerStageNote } from "@/server/fast-operations-actions";
import { QuickOrderPhoto } from "./quick-order-photo";
import { Button, Feedback } from "./ui";
export function StageNoteEditor({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [step, setStep] = useState<StepKey | "">("");
  const [text, setText] = useState("");
  const [correction, setCorrection] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  return (
    <section className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div>
        <h2 className="font-semibold">Registrar o que aconteceu</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Uma observação não interrompe a montagem. Fotos ficam vinculadas à
          etapa escolhida.
        </p>
      </div>
      <label className="text-sm">
        Etapa{" "}
        <select
          value={step}
          onChange={(e) => setStep(e.target.value as StepKey | "")}
          className="ml-2 min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2"
        >
          <option value="">Registro geral</option>
          {Object.entries(STEP_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          start(async () => {
            setError(null);
            try {
              const result = await registerStageNote(
                id,
                step,
                text,
                correction,
              );
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setMessage(result.message);
              setText("");
              setCorrection(false);
              router.refresh();
            } catch {
              setError(
                "Não foi possível confirmar. Atualize a tela antes de tentar novamente.",
              );
            }
          });
        }}
      >
        <textarea
          required
          minLength={3}
          maxLength={2000}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex.: Lensometria conferida; observação sem dano na lente."
          className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-sm"
        />
        {["em_montagem", "em_conferencia", "pronto"].includes(status) && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={correction}
              onChange={(e) => setCorrection(e.target.checked)}
            />
            Este problema exige enviar para correção
          </label>
        )}
        <Button disabled={pending} type="submit">
          {pending
            ? "Salvando…"
            : correction
              ? "Registrar problema e enviar para correção"
              : "Salvar registro · manter no mesmo lugar"}
        </Button>
      </form>
      <QuickOrderPhoto orderId={id} stepKey={step || undefined} />
      <Feedback error={error} message={message} />
    </section>
  );
}
