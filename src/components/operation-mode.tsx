"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const KEY = "oticahub-operation-mode";
let fallback = true;
const EVENT = "oticahub-operation-mode-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(EVENT, callback); };
}

function read() {
  try { const value = window.localStorage.getItem(KEY); return value === null ? fallback : value !== "complete"; } catch { return fallback; }
}

export function useOperationMode() {
  const simple = useSyncExternalStore(subscribe, read, () => true);
  function setSimple(value: boolean) {
    fallback = value;
    try { window.localStorage.setItem(KEY, value ? "simple" : "complete"); } catch { /* Keep the choice for this session. */ }
    window.dispatchEvent(new Event(EVENT));
  }
  return { simple, setSimple };
}

export function OperationView({ simple, children }: { simple: ReactNode; children: ReactNode }) {
  const mode = useOperationMode();
  return <><div hidden={!mode.simple} inert={!mode.simple}>{simple}</div><div hidden={mode.simple} inert={mode.simple}>{children}</div></>;
}

export function OperationModeSwitch() {
  const { simple, setSimple } = useOperationMode();
  return <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#cbdadd] bg-white p-1" role="group" aria-label="Modo de uso">
    {([[true, "Dia a dia"], [false, "Completo"]] as const).map(([value, label]) => <button key={String(value)} type="button" aria-pressed={simple === value} onClick={() => setSimple(value)} className={`min-h-11 rounded-md px-2 text-sm font-semibold ${simple === value ? "bg-[#087e83] text-white" : "text-[#425f65]"}`}>{label}</button>)}
  </div>;
}
