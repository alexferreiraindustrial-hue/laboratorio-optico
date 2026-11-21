import { STATUS_LABEL, type OrderStatus } from "@/lib/domain/constants";
import type { Urgency } from "@/lib/domain/urgency";
import { cn } from "@/lib/utils";

export const STATUS_TONE: Record<OrderStatus, { fg: string; bg: string; dot: string }> = {
  aguardando_lentes: { fg: "var(--warning)", bg: "var(--warning-soft)", dot: "var(--warning)" },
  aguardando_montagem: { fg: "var(--muted)", bg: "var(--surface-secondary)", dot: "#8a96a0" },
  em_montagem: { fg: "var(--link)", bg: "var(--accent-soft)", dot: "var(--link)" },
  em_correcao: { fg: "var(--danger)", bg: "var(--danger-soft)", dot: "var(--danger)" },
  em_conferencia: { fg: "var(--link)", bg: "var(--accent-soft)", dot: "var(--link)" },
  pronto: { fg: "var(--ok)", bg: "var(--ok-soft)", dot: "var(--ok)" },
  entregue: { fg: "var(--ink)", bg: "var(--surface-secondary)", dot: "var(--ink)" },
  cancelado: { fg: "var(--muted)", bg: "var(--surface-secondary)", dot: "#a0a8b0" },
};

const urgencyTone: Record<Urgency, { dot: string; fg: string; weight: string }> = {
  vermelho: { dot: "var(--danger)", fg: "var(--danger)", weight: "font-semibold" },
  amarelo: { dot: "var(--warning)", fg: "var(--warning)", weight: "font-semibold" },
  verde: { dot: "var(--ok)", fg: "var(--muted)", weight: "font-medium" },
  cinza: { dot: "#c9d0d4", fg: "var(--muted)", weight: "font-normal" },
};

const urgencyLabel: Record<Urgency, string> = {
  vermelho: "Urgente",
  amarelo: "Atenção",
  verde: "No prazo",
  cinza: "Sem prazo",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-[3px] text-xs font-semibold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function UrgencyMark({ urgency }: { urgency: Urgency }) {
  const tone = urgencyTone[urgency];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]", tone.weight)} style={{ color: tone.fg }}>
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: tone.dot }} />
      {urgencyLabel[urgency]}
    </span>
  );
}
