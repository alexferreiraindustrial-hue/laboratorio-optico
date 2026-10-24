"use client";

import { Activity, ClipboardCheck, Compass, Lightbulb } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/melhoria", label: "Visão geral", icon: Compass },
  { href: "/melhoria/indicadores", label: "Lean Six Sigma", icon: Activity },
  { href: "/melhoria/kaizen", label: "Kaizen", icon: Lightbulb },
  { href: "/melhoria/5s", label: "Auditoria 5S", icon: ClipboardCheck },
];

export function LeanNav() {
  const pathname = usePathname();
  return (
    <nav className="no-print -mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Ferramentas de melhoria contínua">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
              active ? "bg-[#0e6b62] font-semibold text-white shadow-sm" : "border border-[#e2e7e9] bg-white font-medium text-[#44524f] hover:border-[#cdd5d8] hover:bg-[#f7f9f9]",
            )}
          >
            <Icon size={16} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
