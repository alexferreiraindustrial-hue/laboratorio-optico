"use client";
// Lista de etiquetas para imprimir depois: fica guardada neste computador (não mexe no banco).
import { useSyncExternalStore } from "react";

const KEY = "lab.etiquetas.lista.v1";
const PRINTED = "lab.etiquetas.impressas.v1";
const EVENT = "lab-label-queue";
const EMPTY: string[] = [];
let cache: { raw: string | null; ids: string[] } = { raw: null, ids: EMPTY };
let printedCache: { raw: string | null; ids: string[] } = { raw: null, ids: EMPTY };

function read(key: string, memo: typeof cache) {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(key); } catch { raw = null; }
  if (raw === memo.raw) return memo;
  let ids: string[] = EMPTY;
  try { const parsed = raw ? JSON.parse(raw) : []; ids = Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string").slice(0, 300) : EMPTY; } catch { ids = EMPTY; }
  return { raw, ids };
}
function write(key: string, ids: string[]) {
  try { window.localStorage.setItem(key, JSON.stringify([...new Set(ids)].slice(-300))); } catch { /* navegador sem armazenamento */ }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener("storage", callback); };
}
export function getLabelQueue() { cache = read(KEY, cache); return cache.ids; }
function getPrinted() { printedCache = read(PRINTED, printedCache); return printedCache.ids; }

export const labelQueue = {
  add(ids: string[]) { write(KEY, [...getLabelQueue(), ...ids]); },
  remove(ids: string[]) { const drop = new Set(ids); write(KEY, getLabelQueue().filter((id) => !drop.has(id))); },
  clear() { write(KEY, []); },
  markPrinted(ids: string[]) { write(PRINTED, [...getPrinted(), ...ids].slice(-1000)); },
};

export function useLabelQueue() {
  return useSyncExternalStore(subscribe, getLabelQueue, () => EMPTY);
}
export function usePrintedLabels() {
  return useSyncExternalStore(subscribe, getPrinted, () => EMPTY);
}
