import { STATUS_LABEL, type OrderStatus } from "@/lib/domain/constants";
import type { Urgency } from "@/lib/domain/urgency";
import { cn } from "@/lib/utils";

export const STATUS_TONE: Record<OrderStatus, { fg: string; bg: string; dot: string }> = {
  aguardando_lentes: { fg: "#87601f", bg: "#fbf3e4", dot: "#87601f" },
  aguardando_montagem: { fg: "#6e6a63", bg: "#efece6", dot: "#8a96a0" },
  em_montagem: { fg: "#6e4b2a", bg: "#f3ece2", dot: "#8c6239" },
  em_correcao: { fg: "#b83a3a", bg: "#f9eaea", dot: "#b83a3a" },
  em_conferencia: { fg: "#6e4b2a", bg: "#f3ece2", dot: "#8c6239" },
  pronto: { fg: "#2e7d5b", bg: "#e8f3ee", dot: "#2e7d5b" },
  entregue: { fg: "#3b4650", bg: "#e6e9ec", dot: "#3b4650" },
  cancelado: { fg: "#6b7680", bg: "#f3f4f6", dot: "#a0a8b0" },
};

const urgencyTone: Record<Urgency, { dot: string; fg: string; weight: string }> = {
  vermelho: { dot: "#b83a3a", fg: "#b83a3a", weight: "font-semibold" },
  amarelo: { dot: "#87601f", fg: "#87601f", weight: "font-semibold" },
  verde: { dot: "#2e7d5b", fg: "#6e6a63", weight: "font-medium" },
  cinza: { dot: "#c9d0d4", fg: "#6e6a63", weight: "font-normal" },
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
