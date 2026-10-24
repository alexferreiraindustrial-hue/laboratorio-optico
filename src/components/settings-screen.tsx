"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { APP_ROLES, ROLE_LABEL, type AppRole } from "@/lib/domain/constants";
import { can } from "@/lib/domain/permissions";
import { DEFAULT_GRID } from "@/lib/domain/powers";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createManagedUser, saveSetting, saveSimpleRecord, updateUserAccess } from "@/server/actions";
import { Button, Feedback, Field, Input, Panel, Select, TextArea } from "./ui";

type Lab = { id: string; name: string; code: string; color: string; active: boolean; notes: string | null };
type Seller = { id: string; name: string; active: boolean; notes: string | null };
type Category = { id: string; name: string; active: boolean };
type Goal = { id: string; laboratory_id: string | null; scope: string; target: number; valid_from: string };
type ProfileRow = { id: string; full_name: string; role: AppRole; active: boolean };
type Audit = { id: string; action: string; entity: string; created_at: string };

const SCOPE_LABEL: Record<string, string> = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
};

export function SettingsScreen({
  role,
  laboratories,
  sellers,
  categories,
  goals,
  settings,
  profiles,
  audit,
  auditError,
}: {
  role: AppRole;
  laboratories: Lab[];
  sellers: Seller[];
  categories: Category[];
  goals: Goal[];
  settings: Record<string, unknown>;
  profiles: ProfileRow[];
  audit: Audit[];
  auditError: string | null;
}) {
  const writable = can(role, "settings.write");
  const operations = (settings.operations ?? {}) as { deadline_alert_hours?: number; org_name?: string };
  const schedule = (settings.schedule ?? {}) as { weekdays?: number[]; start?: string; end?: string };
  const grid = (settings.stock_grid ?? {}) as Record<string, number>;

  return (
    <div className="grid gap-4">
      {!writable ? (
        <p className="rounded-xl border border-[#f0e2c8] bg-[#fff8eb] px-4 py-3 text-sm text-[#8a5a12]">
          Seu perfil pode consultar estas informações, mas o banco recusa alterações.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {/* Laboratórios */}
        <SettingsCard title="Laboratórios">
          <ItemList empty="Nenhum laboratório cadastrado.">
            {laboratories.map((lab) => (
              <ItemRow
                key={lab.id}
                title={
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <i className="inline-block h-2 w-2 rounded-full" style={{ background: lab.color }} />
                    <span>
                      {lab.name} · {lab.code} ·{" "}
                      <span className={lab.active ? "text-[#1d6b45]" : "text-[#b42318]"}>
                        {lab.active ? "ativo" : "inativo"}
                      </span>
                    </span>
                  </span>
                }
                action={
                  writable ? (
                    <TextAction
                      label={lab.active ? "Inativar" : "Ativar"}
                      onAction={() => saveSimpleRecord("laboratories", { active: !lab.active }, lab.id)}
                    />
                  ) : null
                }
              />
            ))}
          </ItemList>
          {writable ? (
            <AddRecordForm
              fields={[
                ["name", "Nome"],
                ["code", "Identificação"],
                ["color", "Cor"],
                ["notes", "Observações"],
              ]}
              onSave={(values) => saveSimpleRecord("laboratories", { ...values, active: true })}
            />
          ) : null}
          <div className="mt-4">
            <SettingsTable
              headers={["Nome", "Identificação", "Status"]}
              empty="Sem laboratórios."
              rows={laboratories.map((lab) => [
                <span key={`${lab.id}-n`} className="font-medium">
                  {lab.name}
                </span>,
                <span key={`${lab.id}-c`} className="font-mono text-xs">
                  {lab.code}
                </span>,
                <span key={`${lab.id}-s`} className={lab.active ? "font-medium text-[#1d6b45]" : "font-medium text-[#b42318]"}>
                  {lab.active ? "ativo" : "inativo"}
                </span>,
              ])}
            />
          </div>
        </SettingsCard>

        {/* Vendedores */}
        <SettingsCard title="Vendedores">
          <ItemList empty="Nenhum vendedor cadastrado.">
            {sellers.map((seller) => (
              <ItemRow
                key={seller.id}
                title={seller.name}
                badge={<StatusBadge active={seller.active} />}
                action={
                  writable ? (
                    <ToggleSwitch
                      active={seller.active}
                      onToggle={() => saveSimpleRecord("sellers", { active: !seller.active }, seller.id)}
                    />
                  ) : null
                }
              />
            ))}
          </ItemList>
          {writable ? (
            <AddRecordForm
              fields={[
                ["name", "Nome"],
                ["notes", "Observações"],
              ]}
              onSave={(values) => saveSimpleRecord("sellers", { ...values, active: true })}
            />
          ) : null}
        </SettingsCard>

        {/* Categorias de defeitos */}
        <SettingsCard title="Categorias de defeitos">
          <ItemList empty="Nenhuma categoria cadastrada.">
            {categories.map((category) => (
              <ItemRow
                key={category.id}
                title={category.name}
                action={
                  writable ? (
                    <ToggleSwitch
                      active={category.active}
                      onToggle={() => saveSimpleRecord("quality_categories", { active: !category.active }, category.id)}
                    />
                  ) : (
                    <StatusBadge active={category.active} />
                  )
                }
              />
            ))}
          </ItemList>
          {writable ? (
            <AddRecordForm
              fields={[["name", "Categoria"]]}
              onSave={(values) =>
                saveSimpleRecord("quality_categories", {
                  ...values,
                  active: true,
                  sort_order: categories.length + 1,
                })
              }
            />
          ) : null}
        </SettingsCard>

        {/* Metas de produção */}
        <SettingsCard title="Metas de produção">
          <GoalForm laboratories={laboratories} disabled={!writable} />
          <div className="mt-4">
            <SettingsTable
              headers={["Tipo", "Qtd", "Desde", "Lab"]}
              empty='Nenhuma meta. Percentuais ficam "sem meta".'
              rows={goals.map((goal) => [
                <span key={`${goal.id}-s`}>{SCOPE_LABEL[goal.scope] ?? goal.scope}</span>,
                <span key={`${goal.id}-t`}>{goal.target}</span>,
                <span key={`${goal.id}-d`}>{goal.valid_from}</span>,
                <span key={`${goal.id}-l`}>
                  {laboratories.find((lab) => lab.id === goal.laboratory_id)?.name ?? "Todos"}
                </span>,
              ])}
            />
          </div>
        </SettingsCard>

        {/* Funcionamento */}
        <SettingsCard title="Funcionamento">
          <ScheduleForm initial={schedule} disabled={!writable} />
        </SettingsCard>

        {/* Grade de estoque */}
        <JsonSetting
          title="Grade de estoque"
          disabled={!writable}
          initial={{
            sphere_min_cents: grid.sphere_min_cents ?? DEFAULT_GRID.sphereMinCents,
            sphere_max_cents: grid.sphere_max_cents ?? DEFAULT_GRID.sphereMaxCents,
            cylinder_min_cents: grid.cylinder_min_cents ?? DEFAULT_GRID.cylinderMinCents,
            cylinder_max_cents: grid.cylinder_max_cents ?? DEFAULT_GRID.cylinderMaxCents,
            step_cents: grid.step_cents ?? DEFAULT_GRID.stepCents,
          }}
          onSave={(value) => saveSetting("stock_grid", value)}
          fields={[
            ["sphere_min_cents", "Esférico mínimo", "number"],
            ["sphere_max_cents", "Esférico máximo", "number"],
            ["cylinder_min_cents", "Cilíndrico mínimo", "number"],
            ["cylinder_max_cents", "Cilíndrico máximo", "number"],
            ["step_cents", "Incremento (25 = 0,25)", "number"],
          ]}
        />

        {/* Identidade (compacto, mantém função) */}
        <JsonSetting
          title="Identidade e alertas"
          disabled={!writable}
          initial={{
            deadline_alert_hours: operations.deadline_alert_hours ?? 24,
            org_name: operations.org_name ?? "Laboratório Óptico",
          }}
          onSave={(value) => saveSetting("operations", value)}
          fields={[
            ["org_name", "Nome do laboratório", "text"],
            ["deadline_alert_hours", "Horas de antecedência", "number"],
          ]}
        />

        {/* Usuários e permissões */}
        <SettingsCard title="Usuários e permissões" className="xl:col-span-2">
          {can(role, "users.manage") ? <UserCreateForm /> : null}
          <div className="mt-4">
            {can(role, "users.manage") ? (
              <div className="overflow-x-auto rounded-xl border border-[#e2e7e9]">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-[#f7f9f9] text-xs font-medium uppercase tracking-wide text-[#6e7c7a]">
                    <tr>
                      <th className="px-3 py-2.5">Nome</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Permissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((profile, index) => (
                      <UserRoleRow key={profile.id} profile={profile} striped={index % 2 === 1} />
                    ))}
                    {profiles.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-[#6e7c7a]">
                          Nenhum usuário encontrado.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : (
              <SettingsTable
                headers={["Nome", "Status", "Permissão"]}
                empty="Nenhum usuário encontrado."
                rows={profiles.map((profile) => [
                  <span key={`${profile.id}-n`} className="font-medium">
                    {profile.full_name}
                  </span>,
                  <StatusBadge key={`${profile.id}-b`} active={profile.active} />,
                  <span key={`${profile.id}-r`}>{ROLE_LABEL[profile.role]}</span>,
                ])}
              />
            )}
          </div>
        </SettingsCard>

        {/* Auditoria */}
        <SettingsCard title="Auditoria recente" className="xl:col-span-2 2xl:col-span-2">
          {auditError ? <p className="mb-3 text-sm text-[#8a5a12]">{auditError}</p> : null}
          <SettingsTable
            headers={["Data", "Ação", "Tabela"]}
            empty="Nenhum evento visível para este perfil."
            rows={audit.map((item) => [
              <span key={`${item.id}-d`}>{formatDateTime(item.created_at)}</span>,
              <span
                key={`${item.id}-a`}
                className="rounded-md bg-[#f2f5f5] px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-[#44524f]"
              >
                {item.action}
              </span>,
              <span key={`${item.id}-e`}>{item.entity}</span>,
            ])}
          />
        </SettingsCard>
      </div>
    </div>
  );
}

function SettingsCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn("rounded-xl border-[#e2e7e9] p-4 shadow-sm", className)}>
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-[#13201f]">{title}</h2>
      {children}
    </Panel>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        active ? "bg-[#ddefe4] text-[#1d6b45]" : "bg-[#f3e8e8] text-[#b42318]",
      )}
    >
      {active ? "ativo" : "inativo"}
    </span>
  );
}

function ToggleSwitch({ active, onToggle }: { active: boolean; onToggle: () => Promise<unknown> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await onToggle();
          router.refresh();
        })
      }
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50",
        active ? "bg-[#0e6b62]" : "bg-[#cdd5d8]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
          active && "translate-x-4",
        )}
      />
    </button>
  );
}

function TextAction({ label, onAction }: { label: string; onAction: () => Promise<unknown> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await onAction();
          router.refresh();
        })
      }
      className="shrink-0 text-xs font-medium text-[#0e6b62] hover:underline disabled:opacity-50"
    >
      {pending ? "..." : label}
    </button>
  );
}

function ItemList({ children, empty }: { children: ReactNode; empty: string }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  if (items.length === 0) {
    return <p className="rounded-lg bg-[#f7f9f9] px-3 py-3 text-sm text-[#6e7c7a]">{empty}</p>;
  }
  return (
    <ul className="max-h-48 divide-y divide-[#eef1f3] overflow-y-auto rounded-lg border border-[#e2e7e9] bg-white">
      {children}
    </ul>
  );
}

function ItemRow({
  title,
  badge,
  action,
}: {
  title: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <div className="min-w-0 flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-[#13201f]">{title}</span>
        {badge}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </li>
  );
}

function SettingsTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg bg-[#f7f9f9] px-3 py-3 text-sm text-[#6e7c7a]">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#e2e7e9]">
      <table className="w-full min-w-[280px] text-left text-sm">
        <thead className="bg-[#f7f9f9] text-[11px] font-medium uppercase tracking-wide text-[#6e7c7a]">
          <tr>
            {headers.map((header) => (
              <th key={header || "actions"} className="px-2.5 py-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, index) => (
            <tr key={index} className={cn("border-t border-[#eef1f3]", index % 2 === 1 && "bg-[#fafbfc]")}>
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-2.5 py-2 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddRecordForm({
  fields,
  onSave,
}: {
  fields: [string, string][];
  onSave: (values: Record<string, string>) => Promise<{ ok: boolean; message?: string }>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mt-3 grid gap-2.5 border-t border-[#eef1f3] pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const values = Object.fromEntries(fields.map(([key]) => [key, String(formData.get(key) ?? "")]));
        startTransition(async () => {
          const result = await onSave(values);
          if (!result.ok) {
            setMessage(null);
            setError(result.message ?? "Não foi possível salvar.");
            return;
          }
          setError(null);
          setMessage(result.message ?? "Salvo.");
          form.reset();
          router.refresh();
        });
      }}
    >
      <div className={cn("grid gap-2.5", fields.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
        {fields.map(([key, label]) => (
          <div key={key} className={key === "notes" || key === "color" ? "col-span-2" : undefined}>
            <Field label={label}>
              {key === "notes" ? (
                <TextArea name={key} rows={2} />
              ) : key === "color" ? (
                <Input name={key} required type="color" defaultValue="#0e6b62" className="h-10 cursor-pointer overflow-hidden p-1" />
              ) : (
                <Input name={key} required={key !== "notes"} type="text" />
              )}
            </Field>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Salvando..." : "Adicionar"}
        </Button>
        <Feedback error={error} message={message} />
      </div>
    </form>
  );
}

function GoalForm({ laboratories, disabled }: { laboratories: Lab[]; disabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (disabled) return null;
  return (
    <form
      className="grid gap-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = await saveSimpleRecord("production_goals", {
            laboratory_id: String(formData.get("laboratory_id") || "") || null,
            scope: String(formData.get("scope")),
            target: Number(formData.get("target")),
            valid_from: String(formData.get("valid_from")),
          });
          if (!result.ok) {
            setMessage(null);
            setError(result.message ?? "Não foi possível salvar.");
            return;
          }
          setError(null);
          setMessage("Meta salva.");
          form.reset();
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Desde">
          <Input name="valid_from" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="Tipo">
          <Select name="scope" defaultValue="daily">
            <option value="daily">Diária</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </Select>
        </Field>
      </div>
      <Field label="Quantidade">
        <Input name="target" type="number" min={0} required placeholder="0" />
      </Field>
      <Field label="Laboratório">
        <Select name="laboratory_id" defaultValue="">
          <option value="">Todos os laboratórios</option>
          {laboratories.map((lab) => (
            <option key={lab.id} value={lab.id}>
              {lab.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Salvando..." : "Salvar meta"}
        </Button>
        <Feedback error={error} message={message} />
      </div>
    </form>
  );
}

function JsonSetting({
  title,
  initial,
  fields,
  disabled,
  onSave,
}: {
  title: string;
  initial: Record<string, string | number>;
  fields: [string, string, "number" | "text"][];
  disabled: boolean;
  onSave: (value: Record<string, string | number>) => Promise<{ ok: boolean; message?: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <SettingsCard title={title}>
      <form
        className="grid grid-cols-2 gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const value: Record<string, string | number> = {};
          for (const [key, , type] of fields) {
            const raw = String(formData.get(key) ?? "");
            value[key] = type === "number" ? Number(raw) : raw;
          }
          startTransition(async () => {
            const result = await onSave(value);
            if (!result.ok) {
              setMessage(null);
              setError(result.message ?? "Não foi possível salvar.");
              return;
            }
            setError(null);
            setMessage(result.message ?? "Salvo.");
            router.refresh();
          });
        }}
      >
        {fields.map(([key, label, type], index) => (
          <div key={key} className={fields.length % 2 === 1 && index === fields.length - 1 ? "col-span-2" : undefined}>
            <Field label={label}>
              <Input name={key} type={type} defaultValue={String(initial[key] ?? "")} disabled={disabled} />
            </Field>
          </div>
        ))}
        <div className="col-span-2 flex items-center gap-2">
          {disabled ? null : (
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          )}
          <Feedback error={error} message={message} />
        </div>
      </form>
    </SettingsCard>
  );
}

function ScheduleForm({
  initial,
  disabled,
}: {
  initial: { weekdays?: number[]; start?: string; end?: string };
  disabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initial.weekdays ?? [1, 2, 3, 4, 5]));
  const days = [
    [1, "Seg"],
    [2, "Ter"],
    [3, "Qua"],
    [4, "Qui"],
    [5, "Sex"],
    [6, "Sáb"],
    [0, "Dom"],
  ] as const;

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await saveSetting("schedule", {
            weekdays: [...selected],
            start: String(formData.get("start") ?? "08:00"),
            end: String(formData.get("end") ?? "18:00"),
          });
          if (!result.ok) {
            setMessage(null);
            setError(result.message ?? "Não foi possível salvar.");
            return;
          }
          setError(null);
          setMessage("Expediente salvo.");
          router.refresh();
        });
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {days.map(([value, label]) => {
          const on = selected.has(value);
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() =>
                setSelected((current) => {
                  const next = new Set(current);
                  if (next.has(value)) next.delete(value);
                  else next.add(value);
                  return next;
                })
              }
              className={cn(
                "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition-colors disabled:opacity-50",
                on ? "bg-[#0e6b62] text-white" : "bg-[#f2f4f5] text-[#6e7c7a] hover:bg-[#e4e9ee]",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Início">
          <Input type="time" name="start" defaultValue={initial.start ?? "08:00"} disabled={disabled} />
        </Field>
        <Field label="Fim">
          <Input type="time" name="end" defaultValue={initial.end ?? "18:00"} disabled={disabled} />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        {disabled ? null : (
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Salvando..." : "Salvar expediente"}
          </Button>
        )}
        <Feedback error={error} message={message} />
      </div>
    </form>
  );
}

function UserCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-2.5 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = await createManagedUser(formData);
          if (!result.ok) {
            setMessage(null);
            setError(result.message);
            return;
          }
          setError(null);
          setMessage(result.message ?? "Usuário criado.");
          form.reset();
          router.refresh();
        });
      }}
    >
      <Field label="Nome">
        <Input name="fullName" required placeholder="Nome completo" />
      </Field>
      <Field label="E-mail">
        <Input name="email" type="email" required placeholder="email@exemplo.com" />
      </Field>
      <Field label="Senha">
        <Input name="password" type="password" minLength={8} required placeholder="Mínimo 8 caracteres" />
      </Field>
      <Field label="Perfil">
        <Select name="role" defaultValue="consulta">
          {APP_ROLES.map((item) => (
            <option key={item} value={item}>
              {ROLE_LABEL[item]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Criando..." : "Criar usuário"}
        </Button>
        <Feedback error={error} message={message} />
      </div>
    </form>
  );
}

function UserRoleRow({ profile, striped }: { profile: ProfileRow; striped: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <tr className={cn("border-t border-[#eef1f3]", striped && "bg-[#fafbfc]")}>
      <td className="px-3 py-2.5 font-medium text-[#13201f]">{profile.full_name}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <StatusBadge active={profile.active} />
          <ToggleSwitch
            active={profile.active}
            onToggle={async () => {
              const formData = new FormData();
              formData.set("id", profile.id);
              formData.set("role", profile.role);
              formData.set("active", String(!profile.active));
              return updateUserAccess(formData);
            }}
          />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            formData.set("active", String(profile.active));
            startTransition(async () => {
              const result = await updateUserAccess(formData);
              if (!result.ok) setError(result.message);
              else router.refresh();
            });
          }}
        >
          <input type="hidden" name="id" value={profile.id} />
          <Select name="role" defaultValue={profile.role} className="w-auto min-w-[9rem]">
            {APP_ROLES.map((item) => (
              <option key={item} value={item}>
                {ROLE_LABEL[item]}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            Salvar
          </Button>
          <Feedback error={error} />
        </form>
      </td>
    </tr>
  );
}
