import type { Risk } from "@/lib/domain/forecast";
import { cn } from "@/lib/utils";

/**
 * Medidor de progresso no formato de uma lente vista de frente:
 * o aro mostra quanto do serviço já foi feito (com o brilho verde do
 * antirreflexo) e, no vidro, a mira do lensômetro.
 */
const TONES = {
  ok: ["#0e6b62", "#3fb58f"],
  atencao: ["#c98a06", "#f0c04a"],
  risco: ["#c42f22", "#f0705f"],
  pronta: ["#1f8a52", "#5cc98d"],
  neutro: ["#8a96a0", "#b9c2c8"],
} as const;

type Tone = keyof typeof TONES;

function toneFor(risk: Risk | undefined, value: number): Tone {
  if (risk === "risco" || risk === "atrasada") return "risco";
  if (risk === "atencao") return "atencao";
  if (risk === "pronta" || risk === "entregue" || value >= 100) return "pronta";
  if (risk === "cancelada") return "neutro";
  return "ok";
}

export function LensGauge({
  value,
  risk,
  size = 56,
  className,
  label,
}: {
  value: number;
  risk?: Risk;
  size?: number;
  className?: string;
  /** Texto curto abaixo do número (ex.: "pronta"). Só aparece em tamanhos grandes. */
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tone = toneFor(risk, pct);
  const [from, to] = TONES[tone];
  const id = `lens-${tone}`;
  const r = 43;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  const showText = size >= 44;
  const big = size >= 96;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`${pct}% concluído`}
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={`${id}-arc`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <radialGradient id="lens-glass" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f3f8f7" />
          <stop offset="100%" stopColor="#e3eeec" />
        </radialGradient>
      </defs>
      {/* aro */}
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e9ea" strokeWidth="7" />
      {pct > 0 ? (
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={`url(#${id}-arc)`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
      ) : null}
      {/* vidro */}
      <circle cx="50" cy="50" r="36" fill="url(#lens-glass)" />
      {/* mira do lensômetro */}
      <g stroke={from} strokeOpacity={showText ? 0.16 : 0.28} strokeWidth="0.9" fill="none">
        <line x1="17" y1="50" x2="83" y2="50" />
        <line x1="50" y1="17" x2="50" y2="83" />
        <circle cx="50" cy="50" r={showText ? 22 : 12} />
        {showText
          ? [26, 32, 38, 62, 68, 74].map((x) => <line key={x} x1={x} y1="48" x2={x} y2="52" />)
          : null}
      </g>
      {/* reflexo */}
      <path d="M30 34 A24 24 0 0 1 46 22" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" fill="none" opacity="0.9" />
      {showText ? (
        <text
          x="50"
          y={label && big ? 51 : 55}
          textAnchor="middle"
          fontSize={big ? 21 : 22}
          fontWeight="700"
          fill="#13201f"
          style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}
        >
          {pct}
          <tspan fontSize={big ? 11 : 12} fontWeight="600" fill="#6e7c7a" dx="1">%</tspan>
        </text>
      ) : null}
      {label && big ? (
        <text x="50" y="66" textAnchor="middle" fontSize="8.5" fontWeight="600" fill={from}>
          {label}
        </text>
      ) : null}
    </svg>
  );
}

/** Marca do sistema: uma lente com a mira, no verde da casa. */
export function LensMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className={cn("shrink-0", className)}>
      <rect width="32" height="32" rx="9" fill="#0e6b62" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="#7fd8bd" strokeWidth="2.2" />
      <circle cx="16" cy="16" r="6.4" fill="#ffffff" fillOpacity="0.14" />
      <path d="M16 9.5v13M9.5 16h13" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1" />
      <path d="M11.6 12.6a6 6 0 0 1 3.4-2.6" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
