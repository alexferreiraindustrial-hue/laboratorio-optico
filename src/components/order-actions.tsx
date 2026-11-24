"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { allowedTargets } from "@/lib/domain/status";
import { STATUS_LABEL, type AppRole, type OrderStatus } from "@/lib/domain/constants";
import { changeOrderStatus } from "@/server/actions";
import { Button, Feedback, Select } from "./ui";

export function OrderActions({
  orderId,
  status,
  role,
}: {
  orderId: string;
  status: OrderStatus;
  role: AppRole;
}) {
  const router = useRouter();
  const targets = allowedTargets(status, role);
  const [choice,setChoice]=useState<{from:OrderStatus;to:OrderStatus|""}>({from:status,to:""});
  const nextStatus=choice.from===status&&targets.includes(choice.to as OrderStatus)?choice.to:"";
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (targets.length === 0) return null;

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if(pending || !nextStatus) return;
        startTransition(async () => {
          const result = await changeOrderStatus(orderId, nextStatus, note);
          if (!result.ok) {
            setMessage(null);
            setError(result.message);
            return;
          }
          setError(null);
          setMessage(result.message ?? "Status atualizado.");
          setNote("");
          setChoice({from:status,to:""});
          router.refresh();
        });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Select value={nextStatus} onChange={(event) => setChoice({from:status,to:event.target.value as OrderStatus})} aria-label="Novo status">
          <option value="">Escolha o destino do serviço</option>
          {targets.map((target) => (
            <option key={target} value={target}>
              {STATUS_LABEL[target]}
            </option>
          ))}
        </Select>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          required={nextStatus==="em_correcao"}
          minLength={nextStatus==="em_correcao"?3:undefined}
          placeholder={nextStatus==="em_correcao"?"Qual problema exige correção?":"Observação · opcional"}
          className="h-11 min-w-0 flex-1 rounded-md border border-[var(--line)] px-3 text-base md:h-9 md:text-sm"
        />
        <Button type="submit" disabled={pending || !nextStatus} className="w-full sm:w-auto">
          {pending ? "Salvando..." : nextStatus==="pronto"?"Marcar como pronto":nextStatus==="em_conferencia"?"Encaminhar ao médico":nextStatus==="em_correcao"?"Enviar para correção":"Confirmar destino"}
        </Button>
      </div>
      <Feedback error={error} message={message} />
    </form>
  );
}
