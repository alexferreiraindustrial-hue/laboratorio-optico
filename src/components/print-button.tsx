"use client";

import { Button } from "./ui";

export function PrintButton({ label = "Exportar PDF" }: { label?: string }) {
  return (
    <Button variant="secondary" type="button" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
