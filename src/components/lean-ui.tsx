import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function pct(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function num(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function hours(value: number | null | undefined) {
  if (value == null) return "—";
  if (value < 24) return `${num(value)} h`;
  return `${num(value / 24)} dias`;
}

type Tone = "ok" | "warn" | "bad" | "neutral";

const toneStyle: Record<Tone, string> = {
  ok: "bg-[#e8f3ee] text-[#286f51]",
  warn: "bg-[#fbf3e4] text-[#87601f]",
  bad: "bg-[#f9eaea] text-[#b83a3a]",
  neutral: "bg-[#efece6] text-[#6e6a63]",
};

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold", toneStyle[tone], className)}>{children}</span>;
}

export function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  badge,
  tool,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  badge?: string;
  tool?: string;
}) {
  const bar = { ok: "#2e7d5b", warn: "#87601f", bad: "#b83a3a", neutral: "#e2ddd5" }[tone];
  return (
    <article className="relative overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: bar }} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-[#6e6a63]">{label}</p>
        {tool ? <span className="rounded-full bg-[#f3ece2] px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{tool}</span> : null}
      </div>
      <p className="display tabular mt-2 text-[28px] leading-none">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {badge ? <Pill tone={tone}>{badge}</Pill> : null}
        {hint ? <span className="text-xs text-[#6e6a63]">{hint}</span> : null}
      </div>
    </article>
  );
}

export function Card({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-[#6e6a63]">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
