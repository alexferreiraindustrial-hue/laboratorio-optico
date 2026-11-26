"use client";
// Lembrete discreto: quantas etiquetas estão esperando para imprimir.
import { Tags } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLabelQueue } from "./label-queue";

export function LabelQueueChip() {
  const queue = useLabelQueue();
  const pathname = usePathname();
  if (!queue.length || pathname.startsWith("/laboratorio/etiquetas")) return null;
  return (
    <Link href="/laboratorio/etiquetas" className="lq-chip no-print" aria-label={`${queue.length} etiquetas na lista para imprimir`}>
      <Tags size={16} /><b>{queue.length}</b> etiqueta{queue.length === 1 ? "" : "s"} para imprimir
    </Link>
  );
}
