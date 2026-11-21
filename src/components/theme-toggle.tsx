"use client";
import { Moon, Sun } from "lucide-react";
import { useState } from "react";
export function ThemeToggle({ initialDark }: { initialDark: boolean }) {
  const [dark, setDark] = useState(initialDark);
  return <button type="button" aria-label={dark ? "Usar tema claro" : "Usar tema escuro"} aria-pressed={dark}
    className="theme-toggle no-print fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] shadow-[var(--shadow-soft)] lg:bottom-5"
    onClick={() => {
      const next = !dark;
      document.documentElement.dataset.theme = next ? "dark" : "light";
      document.cookie = `lab_theme=${next ? "dark" : "light"}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      setDark(next);
    }}>
    {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    {dark ? "Tema claro" : "Tema escuro"}
  </button>;
}
