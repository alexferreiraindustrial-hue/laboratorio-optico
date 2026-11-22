"use client";

import { Moon, Sun } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// Route changes and refreshes can replace the header without changing the URL.
function subscribeToThemeHost(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
function getThemeHost() { return document.getElementById("theme-control"); }
function getServerThemeHost() { return null; }

export function ThemeToggle({ initialDark }: { initialDark: boolean }) {
  const [dark, setDark] = useState(initialDark);
  const host = useSyncExternalStore(subscribeToThemeHost, getThemeHost, getServerThemeHost);

  const control = <button type="button"
    aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
    title={dark ? "Usar tema claro" : "Usar tema escuro"}
    aria-pressed={dark}
    className={`theme-toggle no-print inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border md:h-9 md:w-9 ${host ? "" : "fixed right-4 top-4 z-40"}`}
    onClick={() => {
      const next = !dark;
      document.documentElement.dataset.theme = next ? "dark" : "light";
      document.cookie = `lab_theme=${next ? "dark" : "light"}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      setDark(next);
    }}>
    {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
  </button>;

  return host ? createPortal(control, host) : control;
}
