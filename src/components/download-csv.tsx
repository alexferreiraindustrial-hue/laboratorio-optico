"use client";

import { toCsv } from "@/lib/csv";
import { Button } from "./ui";

export function DownloadCsv({
  filename,
  rows,
}: {
  filename: string;
  rows: Record<string, string | number | null | undefined>[];
}) {
  return (
    <Button
      variant="secondary"
      type="button"
      onClick={() => {
        const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
      }}
    >
      Exportar CSV
    </Button>
  );
}
