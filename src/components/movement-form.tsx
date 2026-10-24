"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Feedback, Input, Select } from "@/components/ui";
import type { AppRole } from "@/lib/domain/constants";
import { can } from "@/lib/domain/permissions";
import { moveStock } from "@/server/actions";

export function MovementForm({ stockId, role }: { stockId: string; role: AppRole }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!can(role, "stock.write")) {
    return <p className="mt-2 text-sm text-[#6e7c7a]">Seu perfil consulta o saldo, mas não movimenta o estoque.</p>;
  }

  return (
    <form
      className="mt-3 grid gap-2 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = await moveStock(formData);
          if (!result.ok) {
            setMessage(null);
            setError(result.message);
            return;
          }
          setError(null);
          setMessage(result.message ?? "Movimentação registrada.");
          form.reset();
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="stockId" value={stockId} />
      <Select name="type" defaultValue="entrada">
        <option value="entrada">Entrada</option>
        <option value="saida">Saída</option>
        <option value="ajuste">Ajuste de inventário</option>
        <option value="devolucao">Devolução</option>
        <option value="correcao">Correção de divergência</option>
      </Select>
      <Input name="quantity" type="number" required placeholder="Quantidade" />
      <Input name="reason" required placeholder="Motivo" className="md:col-span-2" />
      <Input name="lot" placeholder="Lote, se houver" />
      {can(role, "stock.exception") ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowNegative" value="true" />
          Permitir saldo negativo auditado
        </label>
      ) : null}
      <div className="md:col-span-2 flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Registrando..." : "Registrar movimentação"}</Button>
        <Feedback error={error} message={message} />
      </div>
    </form>
  );
}
