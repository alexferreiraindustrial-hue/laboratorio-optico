"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { STATUS_LABEL, type OrderStatus } from "@/lib/domain/constants";
import type { LeanSettings } from "@/lib/domain/lean";
import { saveLeanSettings } from "@/server/lean-actions";
import { Button, Input } from "./ui";

const COLUMNS: OrderStatus[] = ["aguardando_lentes", "aguardando_montagem", "em_montagem", "em_correcao", "em_conferencia", "pronto"];

export function LeanSettingsForm({ settings, wipNow }: { settings: LeanSettings; wipNow: Record<string, number> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [wip, setWip] = useState<Record<string, string>>(
    Object.fromEntries(COLUMNS.map((status) => [status, settings.wip?.[status] ? String(settings.wip[status]) : ""])),
  );
  const [minutes, setMinutes] = useState(String(settings.available_minutes_per_day ?? 480));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await saveLeanSettings({
        wip: Object.fromEntries(Object.entries(wip).map(([key, value]) => [key, Number(value) || 0])),
        available_minutes_per_day: Number(minutes) || 0,
      });
      if (result.ok) {
        toast.success(result.message ?? "Salvo.");
        router.refresh();
      } else toast.error(result.message);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {COLUMNS.map((status) => {
          const limit = Number(wip[status]) || 0;
          const now = wipNow[status] ?? 0;
          const over = limit > 0 && now > limit;
          return (
            <label key={status} className="flex items-center gap-3 rounded-lg border border-[#e2e7e9] px-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium">{STATUS_LABEL[status]}</span>
                <span className={`text-xs ${over ? "font-semibold text-[#a3261b]" : "text-[#6e7c7a]"}`}>
                  Agora: {now}
                  {over ? " · acima do limite" : ""}
                </span>
              </span>
              <Input
                inputMode="numeric"
                aria-label={`Limite WIP de ${STATUS_LABEL[status]}`}
                placeholder="∞"
                className="w-16 text-center"
                value={wip[status]}
                onChange={(event) => setWip((current) => ({ ...current, [status]: event.target.value.replace(/\D/g, "").slice(0, 3) }))}
              />
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-[#44524f]">Minutos produtivos por dia (para o takt time)</span>
          <Input inputMode="numeric" className="w-32" value={minutes} onChange={(event) => setMinutes(event.target.value.replace(/\D/g, "").slice(0, 4))} />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar limites"}
        </Button>
      </div>
    </form>
  );
}
