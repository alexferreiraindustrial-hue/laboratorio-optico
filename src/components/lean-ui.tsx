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
  ok: "bg-[#e6f4ec] text-[#1c6b43]",
  warn: "bg-[#fdf3dc] text-[#8a5a00]",
  bad: "bg-[#fdecea] text-[#a3261b]",
  neutral: "bg-[#eef1f3] text-[#44524f]",
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
  const bar = { ok: "#23955a", warn: "#d99a0b", bad: "#d2382b", neutral: "#cdd5d8" }[tone];
  return (
    <article className="relative overflow-hidden rounded-xl border border-[#e2e7e9] bg-white p-4 transition-shadow hover:shadow-[0_8px_24px_-16px_rgba(19,32,31,0.35)]">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: bar }} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-[#6e7c7a]">{label}</p>
        {tool ? <span className="rounded bg-[#f2f5f5] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[#6e7c7a]">{tool}</span> : null}
      </div>
      <p className="tabular mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em]">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {badge ? <Pill tone={tone}>{badge}</Pill> : null}
        {hint ? <span className="text-xs text-[#6e7c7a]">{hint}</span> : null}
      </div>
    </article>
  );
}

export function Card({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-[#e2e7e9] bg-white", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef1f3] px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-[#6e7c7a]">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
