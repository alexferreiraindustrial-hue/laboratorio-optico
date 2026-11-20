"use client";

import { createContext, useContext, type ReactNode } from "react";

const OperationMode = createContext(false);

export function OperationModeProvider({ simple, children }: { simple: boolean; children: ReactNode }) {
  return <OperationMode.Provider value={simple}>{children}</OperationMode.Provider>;
}

export function useOperationMode() {
  return { simple: useContext(OperationMode) };
}

export function OperationView({ simple, children }: { simple: ReactNode; children: ReactNode }) {
  const mode = useOperationMode();
  return <><div hidden={!mode.simple} inert={!mode.simple}>{simple}</div><div hidden={mode.simple} inert={mode.simple}>{children}</div></>;
}
