-- Melhoria contínua: Kaizen (PDCA + 5 Porquês) e auditorias 5S.
-- Execute no SQL Editor do Supabase uma única vez, depois das migrações anteriores.

-- ---------------------------------------------------------------------------
-- Kaizen
-- ---------------------------------------------------------------------------

create table if not exists public.kaizen_ideas (
  id uuid primary key default gen_random_uuid(),
  code serial,
  title text not null check (char_length(title) between 3 and 140),
  problem text not null check (char_length(problem) between 3 and 2000),
  proposal text not null default '' check (char_length(proposal) <= 2000),
  area text not null default 'geral',
  category text not null default 'fluxo'
    check (category in ('qualidade', 'fluxo', '5s', 'seguranca', 'custo', 'ergonomia')),
  -- PDCA: ideia (Plan) -> em_teste (Do) -> verificacao (Check) -> padronizada (Act)
  status text not null default 'ideia'
    check (status in ('ideia', 'em_teste', 'verificacao', 'padronizada', 'descartada')),
  impact smallint not null default 2 check (impact between 1 and 3),
  effort smallint not null default 2 check (effort between 1 and 3),
  whys jsonb not null default '[]'::jsonb,
  root_cause text,
  result text,
  gain_minutes_day integer check (gain_minutes_day is null or gain_minutes_day between 0 and 1440),
  owner_id uuid references public.profiles (id),
  created_by uuid references public.profiles (id) default auth.uid(),
  started_at timestamptz,
  standardized_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kaizen_ideas_status_idx on public.kaizen_ideas (status, updated_at desc);

create or replace function public.kaizen_stage_dates()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'em_teste' and new.started_at is null then
    new.started_at = now();
  end if;
  if new.status = 'padronizada' and new.standardized_at is null then
    new.standardized_at = now();
  end if;
  if new.status <> 'padronizada' then
    new.standardized_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists kaizen_touch on public.kaizen_ideas;
create trigger kaizen_touch before update on public.kaizen_ideas
  for each row execute function public.touch_updated_at();
drop trigger if exists kaizen_dates on public.kaizen_ideas;
create trigger kaizen_dates before insert or update on public.kaizen_ideas
  for each row execute function public.kaizen_stage_dates();
drop trigger if exists kaizen_audit on public.kaizen_ideas;
create trigger kaizen_audit after insert or update or delete on public.kaizen_ideas
  for each row execute function public.audit_change();

-- ---------------------------------------------------------------------------
-- Auditoria 5S
-- ---------------------------------------------------------------------------

create table if not exists public.five_s_audits (
  id uuid primary key default gen_random_uuid(),
  area text not null check (char_length(area) between 2 and 80),
  audited_at timestamptz not null default now(),
  auditor_id uuid references public.profiles (id) default auth.uid(),
  -- notas de 0 a 5 por senso
  seiri numeric(3, 1) not null check (seiri between 0 and 5),
  seiton numeric(3, 1) not null check (seiton between 0 and 5),
  seiso numeric(3, 1) not null check (seiso between 0 and 5),
  seiketsu numeric(3, 1) not null check (seiketsu between 0 and 5),
  shitsuke numeric(3, 1) not null check (shitsuke between 0 and 5),
  answers jsonb not null default '{}'::jsonb,
  notes text check (notes is null or char_length(notes) <= 2000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists five_s_audits_area_idx on public.five_s_audits (area, audited_at desc);

drop trigger if exists five_s_audit_log on public.five_s_audits;
create trigger five_s_audit_log after insert or update or delete on public.five_s_audits
  for each row execute function public.audit_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.kaizen_ideas enable row level security;
alter table public.five_s_audits enable row level security;

drop policy if exists kaizen_select on public.kaizen_ideas;
create policy kaizen_select on public.kaizen_ideas
  for select to authenticated using (public.current_app_role() is not null);
drop policy if exists kaizen_insert on public.kaizen_ideas;
create policy kaizen_insert on public.kaizen_ideas
  for insert to authenticated
  with check (public.current_app_role() in ('admin', 'gestor', 'montador', 'estoquista'));
drop policy if exists kaizen_update on public.kaizen_ideas;
create policy kaizen_update on public.kaizen_ideas
  for update to authenticated
  using (public.current_app_role() in ('admin', 'gestor') or created_by = auth.uid() or owner_id = auth.uid())
  with check (public.current_app_role() in ('admin', 'gestor') or created_by = auth.uid() or owner_id = auth.uid());
drop policy if exists kaizen_delete on public.kaizen_ideas;
create policy kaizen_delete on public.kaizen_ideas
  for delete to authenticated using (public.current_app_role() in ('admin', 'gestor'));

drop policy if exists five_s_select on public.five_s_audits;
create policy five_s_select on public.five_s_audits
  for select to authenticated using (public.current_app_role() is not null);
drop policy if exists five_s_insert on public.five_s_audits;
create policy five_s_insert on public.five_s_audits
  for insert to authenticated
  with check (public.current_app_role() in ('admin', 'gestor', 'montador', 'estoquista'));
drop policy if exists five_s_delete on public.five_s_audits;
create policy five_s_delete on public.five_s_audits
  for delete to authenticated using (public.current_app_role() in ('admin', 'gestor'));

grant select, insert, update, delete on public.kaizen_ideas, public.five_s_audits to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
