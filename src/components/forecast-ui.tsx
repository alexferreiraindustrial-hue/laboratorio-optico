"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { RISK_LABEL, RISK_TONE, type Risk } from "@/lib/domain/forecast";
import { cn } from "@/lib/utils";

export function RiskChip({ risk, className }: { risk: Risk; className?: string }) {
  const tone = RISK_TONE[risk];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-[3px] text-xs font-semibold", className)}
      style={{ background: tone.bg, color: tone.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
      {RISK_LABEL[risk]}
    </span>
  );
}

export function ProgressBar({ value, risk, className, showLabel = true }: { value: number; risk?: Risk; className?: string; showLabel?: boolean }) {
  const color =
    risk === "risco" || risk === "atrasada"
      ? "#d2382b"
      : risk === "atencao"
        ? "#d99a0b"
        : risk === "pronta" || risk === "entregue" || value >= 100
          ? "#23955a"
          : "#0e6b62";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e7ebed]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(3, Math.min(100, value))}%`, background: color }} />
      </div>
      {showLabel ? <span className="tabular w-9 text-right font-mono text-[11px] font-medium text-[#44524f]">{value}%</span> : null}
    </div>
  );
}

/** Botão “Avisar vendedor”: abre o WhatsApp com a mensagem pronta ou copia o texto. */
export function NotifySeller({
  message,
  link,
  sellerName,
  compact = false,
}: {
  message: string;
  link: string | null;
  sellerName?: string | null;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex items-center gap-1.5">
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          title={`Enviar atualização para ${sellerName ?? "o vendedor"} no WhatsApp`}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#1f9d55] font-semibold text-white hover:bg-[#188346]",
            compact ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm",
          )}
        >
          <MessageCircle size={compact ? 13 : 15} />
          {compact ? "Avisar" : `Avisar ${sellerName?.split(" ")[0] ?? "vendedor"}`}
        </a>
      ) : null}
      <button
        type="button"
        onClick={copy}
        title="Copiar mensagem"
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#cdd5d8] bg-white font-medium text-[#44524f] hover:bg-[#f7f9f9]",
          compact ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm",
        )}
      >
        {copied ? <Check size={compact ? 13 : 15} /> : <Copy size={compact ? 13 : 15} />}
        {copied ? "Copiado" : compact ? "" : "Copiar mensagem"}
      </button>
    </div>
  );
}
