"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reactivateOrder } from "@/server/audit-actions";
import { formatDateTime } from "@/lib/format";
import { Button } from "./ui";

/** Aviso de OS em off (auditoria geral), com o botão para trazer de volta. */
export function OffBanner({ id, offAt, editable }: { id: string; offAt: string; editable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="status" className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] p-3">
      <p className="min-w-0 flex-1 text-sm"><b>OS em off</b> desde {formatDateTime(offAt)}: não foi encontrada na auditoria geral. Os dados estão guardados e ela não aparece na operação.</p>
      {editable ? (
        <Button size="sm" disabled={pending} onClick={() => start(async () => {
          const result = await reactivateOrder(id);
          if (!result.ok) return void toast.error(result.message);
          toast.success(result.message ?? "OS reativada.");
          router.refresh();
        })}>Reativar</Button>
      ) : null}
    </div>
  );
}
