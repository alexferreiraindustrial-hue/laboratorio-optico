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
  const [nextStatus, setNextStatus] = useState(targets[0] ?? "");
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
          router.refresh();
        });
      }}
    >
      <div className="flex flex-wrap gap-2">
        <Select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as OrderStatus)} aria-label="Novo status">
          {targets.map((target) => (
            <option key={target} value={target}>
              {STATUS_LABEL[target]}
            </option>
          ))}
        </Select>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Observação da movimentação"
          className="h-9 min-w-48 flex-1 rounded-md border border-[#cdd5d8] px-3 text-sm"
        />
        <Button type="submit" disabled={pending || !nextStatus}>
          {pending ? "Salvando..." : "Movimentar"}
        </Button>
      </div>
      <Feedback error={error} message={message} />
    </form>
  );
}
