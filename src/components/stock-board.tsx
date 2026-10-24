"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Feedback, Field, Input, Panel, Select } from "@/components/ui";
import { stockTone } from "@/lib/domain/stock";
import { DEFAULT_GRID, isOnGrid, powerSeries, type GridConfig } from "@/lib/domain/powers";
import { formatBRLFromCents, formatDiopter } from "@/lib/format";
import type { AppRole } from "@/lib/domain/constants";
import { can } from "@/lib/domain/permissions";
import type { StockRow } from "@/lib/types";
import { saveStockItem, updateThresholds } from "@/server/actions";

function readGrid(value: Record<string, unknown> | undefined): GridConfig {
  if (!value) return DEFAULT_GRID;
  return {
    sphereMinCents: Number(value.sphere_min_cents ?? DEFAULT_GRID.sphereMinCents),
    sphereMaxCents: Number(value.sphere_max_cents ?? DEFAULT_GRID.sphereMaxCents),
    cylinderMinCents: Number(value.cylinder_min_cents ?? DEFAULT_GRID.cylinderMinCents),
    cylinderMaxCents: Number(value.cylinder_max_cents ?? DEFAULT_GRID.cylinderMaxCents),
    stepCents: Number(value.step_cents ?? DEFAULT_GRID.stepCents),
  };
}

const toneClass = {
  vermelho: "bg-[#f8d7d7] text-[#912018]",
  amarelo: "bg-[#f8efd2] text-[#7a5a10]",
  verde: "bg-[#ddefe4] text-[#1d6b45]",
};

export function StockBoard({
  items,
  gridValue,
  role,
  special = false,
}: {
  items: StockRow[];
  gridValue?: Record<string, unknown>;
  role: AppRole;
  special?: boolean;
}) {
  const grid = readGrid(gridValue);
  const [manufacturer, setManufacturer] = useState("");
  const [treatment, setTreatment] = useState("");
  const [selected, setSelected] = useState<{ sphere: number; cylinder: number } | null>(null);
  const [minQty, setMinQty] = useState("1");
  const [idealQty, setIdealQty] = useState("4");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = items.filter((item) => {
    if (manufacturer && (item.manufacturer ?? "") !== manufacturer) return false;
    if (treatment && (item.treatment ?? "") !== treatment) return false;
    return true;
  });
  const manufacturers = [...new Set(items.map((item) => item.manufacturer).filter(Boolean))] as string[];
  const treatments = [...new Set(items.map((item) => item.treatment).filter(Boolean))] as string[];

  const sphere = useMemo(() => powerSeries(grid.sphereMinCents, grid.sphereMaxCents, grid.stepCents), [grid]);
  const cylinder = useMemo(() => powerSeries(grid.cylinderMinCents, grid.cylinderMaxCents, grid.stepCents), [grid]);
  const tooWide = sphere.length * cylinder.length > 2500;

  const cellItems = (sphereCents: number, cylinderCents: number) =>
    filtered.filter((item) => item.sphere_cents === sphereCents && item.cylinder_cents === cylinderCents);

  const selectedItems = selected ? cellItems(selected.sphere, selected.cylinder) : [];

  return (
    <div className="grid gap-4">
      <Panel className="p-3">
        <div className="grid gap-2 md:grid-cols-4">
          <Select value={manufacturer} onChange={(event) => setManufacturer(event.target.value)}>
            <option value="">Todos os fabricantes</option>
            {manufacturers.map((item) => <option key={item}>{item}</option>)}
          </Select>
          <Select value={treatment} onChange={(event) => setTreatment(event.target.value)}>
            <option value="">Todos os tratamentos</option>
            {treatments.map((item) => <option key={item}>{item}</option>)}
          </Select>
          <p className="text-xs text-[#6e7c7a] md:col-span-2">
            Vermelho: zerado ou abaixo do mínimo. Amarelo: acima do mínimo e ainda abaixo do ideal. Verde: no ideal ou acima. O saldo zerado permanece vermelho.
          </p>
        </div>
      </Panel>

      {special ? null : tooWide ? (
        <p className="text-sm text-[#8a5a12]">A faixa configurada gera uma grade grande demais para consulta rápida. Reduza o intervalo em Configurações.</p>
      ) : (
        <Panel className="overflow-auto p-2">
          <table className="border-separate border-spacing-1 text-center text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white px-2">Esf. \ Cil.</th>
                {cylinder.map((value) => <th key={value} className="px-1 font-medium">{formatDiopter(value)}</th>)}
              </tr>
            </thead>
            <tbody>
              {sphere.map((sphereValue) => (
                <tr key={sphereValue}>
                  <th className="sticky left-0 bg-white px-2 text-right font-medium">{formatDiopter(sphereValue)}</th>
                  {cylinder.map((cylinderValue) => {
                    const group = cellItems(sphereValue, cylinderValue);
                    const qty = group.reduce((sum, item) => sum + item.current_qty, 0);
                    const min = group.length ? Math.min(...group.map((item) => item.min_qty)) : 0;
                    const ideal = group.length ? Math.max(...group.map((item) => item.ideal_qty)) : null;
                    const tone = group.length ? stockTone(qty, min, ideal) : "verde";
                    return (
                      <td key={cylinderValue}>
                        <button
                          type="button"
                          onClick={() => setSelected({ sphere: sphereValue, cylinder: cylinderValue })}
                          className={`h-8 min-w-8 rounded ${group.length ? toneClass[tone] : "bg-[#f4f6f8] text-[#8a9694]"}`}
                        >
                          {group.length ? qty : "·"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {selected ? (
        <Panel className="p-4">
          <h2 className="font-medium">{formatDiopter(selected.sphere)} / {formatDiopter(selected.cylinder)}</h2>
          {selectedItems.length === 0 ? (
            <p className="mt-2 text-sm text-[#6e7c7a]">Não há item cadastrado nesta combinação com os filtros atuais.</p>
          ) : (
            <ul className="mt-3 grid gap-2 text-sm">
              {selectedItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef1f3] pb-2">
                  <span>{item.public_code} · saldo {item.current_qty} · mín. {item.min_qty} · {item.location || "sem localização"} · {formatBRLFromCents(item.unit_cost_cents)}</span>
                  <span className="flex gap-3">
                    <Link className="text-[#0e6b62] underline" href={`/estoque/${item.id}`}>Abrir</Link>
                    <Link className="text-[#0e6b62] underline" href={`/estoque/etiquetas?ids=${item.id}`}>Etiqueta</Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {can(role, "stock.write") && selectedItems.length > 0 ? (
            <form
              className="mt-3 flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await updateThresholds(selectedItems.map((item) => item.id), Number(minQty), Number(idealQty));
                  if (!result.ok) setError(result.message);
                  else {
                    setError(null);
                    setMessage(result.message ?? "Reposição atualizada.");
                    router.refresh();
                  }
                });
              }}
            >
              <Field label="Mínimo"><Input value={minQty} onChange={(event) => setMinQty(event.target.value)} /></Field>
              <Field label="Ideal"><Input value={idealQty} onChange={(event) => setIdealQty(event.target.value)} /></Field>
              <Button type="submit" variant="secondary" disabled={pending}>Aplicar nestes itens</Button>
            </form>
          ) : null}
          {can(role, "stock.write") ? (
            <StockCreateForm
              sphere={formatDiopter(selected.sphere)}
              cylinder={formatDiopter(selected.cylinder)}
              isSpecial={!isOnGrid(selected.sphere, selected.cylinder, grid)}
            />
          ) : null}
          <Feedback error={error} message={message} />
        </Panel>
      ) : null}
    </div>
  );
}

export function StockCreateForm({
  sphere = "",
  cylinder = "",
  isSpecial = false,
}: {
  sphere?: string;
  cylinder?: string;
  isSpecial?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-4 grid gap-3 border-t border-[#eef1f3] pt-3 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await saveStockItem(formData);
          if (!result.ok) {
            setMessage(null);
            setError(result.message);
            return;
          }
          setError(null);
          setMessage(result.message ?? "Lente cadastrada.");
          if (result.id) router.push(`/estoque/${result.id}`);
        });
      }}
    >
      <input type="hidden" name="isSpecial" value={String(isSpecial)} />
      <Field label="Esférico"><Input name="sphere" required defaultValue={sphere} /></Field>
      <Field label="Cilíndrico"><Input name="cylinder" required defaultValue={cylinder} /></Field>
      <Field label="Adição"><Input name="addition" placeholder="opcional" /></Field>
      <Field label="Fabricante"><Input name="manufacturer" /></Field>
      <Field label="Marca ou modelo"><Input name="brand" /></Field>
      <Field label="Material"><Input name="material" /></Field>
      <Field label="Índice"><Input name="refractiveIndex" placeholder="1,56" /></Field>
      <Field label="Tratamento"><Input name="treatment" /></Field>
      <Field label="Cor"><Input name="color" /></Field>
      <Field label="Diâmetro (mm)"><Input name="diameterMm" /></Field>
      <Field label="Tipo"><Input name="lensType" /></Field>
      <Field label="Lote"><Input name="lotCode" /></Field>
      <Field label="Localização"><Input name="location" /></Field>
      <Field label="Mínimo"><Input name="minQty" type="number" min={0} defaultValue={0} /></Field>
      <Field label="Ideal"><Input name="idealQty" type="number" min={0} defaultValue={0} /></Field>
      <Field label="Quantidade inicial"><Input name="initialQty" type="number" min={0} defaultValue={0} /></Field>
      <Field label="Custo unitário"><Input name="unitCost" placeholder="0,00" /></Field>
      <Field label="Observações"><Input name="notes" /></Field>
      <div className="md:col-span-4 flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Cadastrar combinação"}</Button>
        <Feedback error={error} message={message} />
      </div>
    </form>
  );
}
