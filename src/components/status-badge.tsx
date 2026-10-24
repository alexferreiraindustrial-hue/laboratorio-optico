import { STATUS_LABEL, type OrderStatus } from "@/lib/domain/constants";
import type { Urgency } from "@/lib/domain/urgency";
import { cn } from "@/lib/utils";

export const STATUS_TONE: Record<OrderStatus, { fg: string; bg: string; dot: string }> = {
  aguardando_lentes: { fg: "#8a5a00", bg: "#fdf3dc", dot: "#d99a0b" },
  aguardando_montagem: { fg: "#44524f", bg: "#eef1f3", dot: "#8a96a0" },
  em_montagem: { fg: "#0a4f48", bg: "#e4f1ef", dot: "#0e6b62" },
  em_correcao: { fg: "#a3261b", bg: "#fdecea", dot: "#d2382b" },
  em_conferencia: { fg: "#0a4f48", bg: "#e4f1ef", dot: "#0e6b62" },
  pronto: { fg: "#1c6b43", bg: "#e3f4ea", dot: "#23955a" },
  entregue: { fg: "#3b4650", bg: "#e6e9ec", dot: "#3b4650" },
  cancelado: { fg: "#6b7680", bg: "#f3f4f6", dot: "#a0a8b0" },
};

const urgencyTone: Record<Urgency, { dot: string; fg: string; weight: string }> = {
  vermelho: { dot: "#d2382b", fg: "#a3261b", weight: "font-semibold" },
  amarelo: { dot: "#d99a0b", fg: "#8a5a00", weight: "font-semibold" },
  verde: { dot: "#23955a", fg: "#44524f", weight: "font-medium" },
  cinza: { dot: "#c9d0d4", fg: "#8a9694", weight: "font-normal" },
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
