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
  vermelho: "bg-[#f8d7d7] text-[#963030]",
  amarelo: "bg-[#f8efd2] text-[#7a5a10]",
  verde: "bg-[#e8f3ee] text-[#286f51]",
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

  const [onlyStocked, setOnlyStocked] = useState(false);
  const [band, setBand] = useState<"todas" | "neg" | "pos">("todas");
  const [jumpSphere, setJumpSphere] = useState("");
  const [jumpCylinder, setJumpCylinder] = useState("");

  const sphere = useMemo(() => powerSeries(grid.sphereMinCents, grid.sphereMaxCents, grid.stepCents), [grid]);
  const cylinder = useMemo(() => powerSeries(grid.cylinderMinCents, grid.cylinderMaxCents, grid.stepCents), [grid]);
  const visibleSphere = useMemo(() => {
    if (band === "neg") return sphere.filter((value) => value < 0);
    if (band === "pos") return sphere.filter((value) => value >= 0);
    return sphere;
  }, [sphere, band]);

  const cellItems = (sphereCents: number, cylinderCents: number) =>
    filtered.filter((item) => item.sphere_cents === sphereCents && item.cylinder_cents === cylinderCents);

  const selectedItems = selected ? cellItems(selected.sphere, selected.cylinder) : [];

  function jumpToGrade() {
    const sph = jumpSphere.trim() ? Number.parseInt(String(Math.round(Number(jumpSphere.replace(",", ".")) * 100)), 10) : null;
    const cyl = jumpCylinder.trim() ? Number.parseInt(String(Math.round(Number(jumpCylinder.replace(",", ".")) * 100)), 10) : null;
    const nextSphere = sph != null && Number.isFinite(sph) ? sphere.find((value) => value === sph) : null;
    const nextCylinder = cyl != null && Number.isFinite(cyl) ? cylinder.find((value) => value === cyl) : cylinder.includes(0) ? 0 : cylinder[0];
    if (nextSphere == null || nextCylinder == null) {
      setError("Use um grau da grade, como -1,25 e -0,75.");
      return;
    }
    setError(null);
    setBand(nextSphere < 0 ? "neg" : "pos");
    setSelected({ sphere: nextSphere, cylinder: nextCylinder });
    requestAnimationFrame(() => {
      document.getElementById(`grau-${nextSphere}-${nextCylinder}`)?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    });
  }

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
          <label className="flex h-11 items-center gap-2 text-sm md:h-9">
            <input type="checkbox" checked={onlyStocked} onChange={(event) => setOnlyStocked(event.target.checked)} />
            Só graus já cadastrados
          </label>
          <p className="text-xs text-[#6e6a63]">
            Linha = esférico. Coluna = cilíndrico. Número = saldo. <strong>+</strong> = grau ainda sem lente — clique para cadastrar.
          </p>
        </div>
        {special ? null : (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="flex gap-1 rounded-lg bg-[#efece6] p-1">
              {([
                ["todas", "Grade inteira"],
                ["neg", "Esférico −"],
                ["pos", "Esférico 0 / +"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBand(key)}
                  className={`h-9 rounded-md px-3 text-xs font-semibold ${band === key ? "bg-white text-[#222222] shadow-sm" : "text-[#6e6a63]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Field label="Ir ao esférico">
              <Input value={jumpSphere} onChange={(event) => setJumpSphere(event.target.value)} placeholder="-1,25" />
            </Field>
            <Field label="Cilíndrico">
              <Input value={jumpCylinder} onChange={(event) => setJumpCylinder(event.target.value)} placeholder="-0,75" />
            </Field>
            <Button type="button" variant="secondary" onClick={jumpToGrade}>Encontrar na grade</Button>
          </div>
        )}
      </Panel>

      {special ? null : (
        <Panel className="overflow-auto p-2">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#6e6a63]">
            Cilíndrico → &nbsp;&nbsp; Esférico ↓ &nbsp;· passo {formatDiopter(grid.stepCents).replace("+", "")}
          </p>
          <table className="border-separate border-spacing-1 text-center text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-white px-2 py-2 text-[11px] font-semibold text-[#6e6a63]">Esf. \ Cil.</th>
                {cylinder.map((value) => (
                  <th key={value} className="sticky top-0 z-10 min-w-11 bg-[#f7f6f3] px-1 py-2 font-semibold text-[#6e6a63]">
                    {formatDiopter(value)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleSphere.map((sphereValue) => (
                <tr key={sphereValue}>
                  <th className="sticky left-0 z-10 bg-white px-2 text-right font-semibold text-[#222222]">{formatDiopter(sphereValue)}</th>
                  {cylinder.map((cylinderValue) => {
                    const group = cellItems(sphereValue, cylinderValue);
                    if (onlyStocked && group.length === 0) {
                      return <td key={cylinderValue} className="min-w-11" />;
                    }
                    const qty = group.reduce((sum, item) => sum + item.current_qty, 0);
                    const min = group.length ? Math.min(...group.map((item) => item.min_qty)) : 0;
                    const ideal = group.length ? Math.max(...group.map((item) => item.ideal_qty)) : null;
                    const tone = group.length ? stockTone(qty, min, ideal) : "verde";
                    const on = selected?.sphere === sphereValue && selected?.cylinder === cylinderValue;
                    return (
                      <td key={cylinderValue}>
                        <button
                          type="button"
                          id={`grau-${sphereValue}-${cylinderValue}`}
                          title={group.length ? `${formatDiopter(sphereValue)} / ${formatDiopter(cylinderValue)} · saldo ${qty}` : `Cadastrar ${formatDiopter(sphereValue)} / ${formatDiopter(cylinderValue)}`}
                          onClick={() => setSelected({ sphere: sphereValue, cylinder: cylinderValue })}
                          className={`h-11 min-w-11 rounded-md text-sm font-semibold md:h-9 md:min-w-9 ${
                            group.length ? toneClass[tone] : "border border-dashed border-[#e2ddd5] bg-[#fbfaf7] text-[#8c6239]"
                          } ${on ? "ring-2 ring-[#8c6239]" : ""}`}
                        >
                          {group.length ? qty : "+"}
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
        <Panel className="p-4" id="grau-selecionado">
          <h2 className="font-medium">
            Grau {formatDiopter(selected.sphere)} / {formatDiopter(selected.cylinder)}
          </h2>
          {selectedItems.length === 0 ? (
            <p className="mt-2 text-sm text-[#6e6a63]">Este grau ainda não está no estoque. Preencha abaixo para incluir na grade.</p>
          ) : (
            <ul className="mt-3 grid gap-2 text-sm">
              {selectedItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#efece6] pb-2">
                  <span>{item.public_code} · saldo {item.current_qty} · mín. {item.min_qty} · {item.location || "sem localização"} · {formatBRLFromCents(item.unit_cost_cents)}</span>
                  <span className="flex gap-3">
                    <Link className="text-[#8c6239] underline" href={`/estoque/${item.id}`}>Abrir</Link>
                    <Link className="text-[#8c6239] underline" href={`/estoque/etiquetas?ids=${item.id}`}>Etiqueta</Link>
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
              key={`${selected.sphere}-${selected.cylinder}`}
              sphere={formatDiopter(selected.sphere)}
              cylinder={formatDiopter(selected.cylinder)}
              isSpecial={!isOnGrid(selected.sphere, selected.cylinder, grid)}
              compact={selectedItems.length === 0}
              onCreated={() => {
                setMessage("Lente incluída na grade.");
                router.refresh();
              }}
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
  compact = false,
  onCreated,
}: {
  sphere?: string;
  cylinder?: string;
  isSpecial?: boolean;
  compact?: boolean;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [more, setMore] = useState(!compact);

  return (
    <form
      className="mt-4 grid gap-3 border-t border-[#efece6] pt-3 md:grid-cols-4"
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
          if (onCreated) onCreated();
          else if (result.id) router.push(`/estoque/${result.id}`);
        });
      }}
    >
      <input type="hidden" name="isSpecial" value={String(isSpecial)} />
      <Field label="Esférico"><Input name="sphere" required defaultValue={sphere} key={`esf-${sphere}`} /></Field>
      <Field label="Cilíndrico"><Input name="cylinder" required defaultValue={cylinder} key={`cil-${cylinder}`} /></Field>
      <Field label="Localização"><Input name="location" placeholder="gaveta / caixa" /></Field>
      <Field label="Quantidade inicial"><Input name="initialQty" type="number" min={0} defaultValue={compact ? "1" : "0"} /></Field>
      <Field label="Mínimo"><Input name="minQty" type="number" min={0} defaultValue={1} /></Field>
      <Field label="Ideal"><Input name="idealQty" type="number" min={0} defaultValue={4} /></Field>
      {more ? (
        <>
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
          <Field label="Custo unitário"><Input name="unitCost" placeholder="0,00" /></Field>
          <Field label="Observações"><Input name="notes" /></Field>
        </>
      ) : (
        <>
          <input type="hidden" name="addition" value="" />
          <input type="hidden" name="manufacturer" value="" />
          <input type="hidden" name="brand" value="" />
          <input type="hidden" name="material" value="" />
          <input type="hidden" name="refractiveIndex" value="" />
          <input type="hidden" name="treatment" value="" />
          <input type="hidden" name="color" value="" />
          <input type="hidden" name="diameterMm" value="" />
          <input type="hidden" name="lensType" value="" />
          <input type="hidden" name="lotCode" value="" />
          <input type="hidden" name="unitCost" value="" />
          <input type="hidden" name="notes" value="" />
          <div className="md:col-span-4">
            <button type="button" className="text-sm font-semibold text-[#8c6239] underline" onClick={() => setMore(true)}>
              Mais detalhes (marca, lote, custo…)
            </button>
          </div>
        </>
      )}
      <div className="md:col-span-4 flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : compact ? "Incluir este grau na grade" : "Cadastrar combinação"}</Button>
        <Feedback error={error} message={message} />
      </div>
    </form>
  );
}
