-- Fluxo de produção: previsão das lentes do laboratório externo, BO/assistência,
-- códigos rápidos de vendedor e loja e rotina do dia (checklist + chegada do motoboy).
-- Execute no SQL Editor do Supabase uma única vez, depois das migrações anteriores.

-- ---------------------------------------------------------------------------
-- 1. Lentes: previsão do laboratório externo e chegada
-- ---------------------------------------------------------------------------

alter table public.service_orders
  add column if not exists lens_expected_at timestamptz,
  add column if not exists lens_supplier_ref text check (lens_supplier_ref is null or char_length(lens_supplier_ref) <= 60),
  add column if not exists lens_arrived_at timestamptz;

create index if not exists service_orders_lens_expected_idx
  on public.service_orders (lens_expected_at) where status = 'aguardando_lentes';

create or replace function public.stamp_lens_arrival()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if old.status = 'aguardando_lentes' and new.status <> 'aguardando_lentes' and new.status <> 'cancelado' then
      new.lens_arrived_at := coalesce(new.lens_arrived_at, now());
    end if;
    if new.status = 'aguardando_lentes' then
      new.lens_arrived_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_lens_arrival on public.service_orders;
create trigger orders_lens_arrival before update on public.service_orders
  for each row execute function public.stamp_lens_arrival();

-- A view precisa ser recriada para expor as novas colunas (o.* é expandido na criação).
drop view if exists public.orders_enriched;

create view public.orders_enriched
with (security_invoker = true) as
select
  o.*,
  l.name as laboratory_name,
  l.color as laboratory_color,
  l.code as laboratory_code,
  s.name as seller_name,
  st.trade_name as store_name,
  st.public_code as store_code,
  public.order_urgency(o.due_at, o.status, o.priority) as urgency
from public.service_orders o
join public.laboratories l on l.id = o.laboratory_id
left join public.sellers s on s.id = o.seller_id
left join public.stores st on st.id = o.store_id;

grant select on public.orders_enriched to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Códigos rápidos (1, 2, 3...) para vendedor e loja no lançamento
-- ---------------------------------------------------------------------------

alter table public.sellers add column if not exists quick_code smallint check (quick_code is null or quick_code between 1 and 999);
alter table public.stores add column if not exists quick_code smallint check (quick_code is null or quick_code between 1 and 999);
create unique index if not exists sellers_quick_code_uidx on public.sellers (quick_code) where quick_code is not null;
create unique index if not exists stores_quick_code_uidx on public.stores (quick_code) where quick_code is not null;

with ordered as (
  select id, row_number() over (order by name) as n from public.sellers where quick_code is null and active
)
update public.sellers s set quick_code = o.n + coalesce((select max(quick_code) from public.sellers), 0)
from ordered o where s.id = o.id;

with ordered as (
  select id, row_number() over (order by trade_name) as n from public.stores where quick_code is null and active
)
update public.stores s set quick_code = o.n + coalesce((select max(quick_code) from public.stores), 0)
from ordered o where s.id = o.id;

create or replace function public.assign_quick_code()
returns trigger
language plpgsql
as $$
declare
  v_next integer;
begin
  if new.quick_code is null then
    execute format('select coalesce(max(quick_code), 0) + 1 from public.%I', tg_table_name) into v_next;
    new.quick_code := least(v_next, 999);
  end if;
  return new;
end;
$$;

drop trigger if exists sellers_quick_code on public.sellers;
create trigger sellers_quick_code before insert on public.sellers
  for each row execute function public.assign_quick_code();
drop trigger if exists stores_quick_code on public.stores;
create trigger stores_quick_code before insert on public.stores
  for each row execute function public.assign_quick_code();

-- ---------------------------------------------------------------------------
-- 3. BO / Assistência: aviso ao vendedor e decisão sobre o óculos
-- ---------------------------------------------------------------------------

alter table public.quality_occurrences
  add column if not exists decision text
    check (decision is null or decision in ('nova_lente', 'refazer', 'reparo', 'cliente_aceita', 'cancelar')),
  add column if not exists decision_note text,
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid references public.profiles (id),
  add column if not exists notified_at timestamptz,
  add column if not exists notified_by uuid references public.profiles (id);

create or replace function public.mark_occurrence_notified(p_id uuid)
returns public.quality_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.quality_occurrences;
begin
  if public.current_app_role() not in ('admin', 'gestor', 'montador') then
    raise exception 'Sem permissão para registrar o aviso.';
  end if;
  update public.quality_occurrences
  set notified_at = now(), notified_by = auth.uid()
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'Ocorrência não encontrada.';
  end if;
  insert into public.quality_actions (occurrence_id, description, status, user_id)
  values (v_row.id, 'Vendedor/gestor avisado', v_row.status, auth.uid());
  return v_row;
end;
$$;

create or replace function public.decide_occurrence(
  p_id uuid,
  p_decision text,
  p_note text,
  p_lens_expected_at timestamptz
)
returns public.quality_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_row public.quality_occurrences;
  v_order public.service_orders;
  v_label text;
begin
  if v_role not in ('admin', 'gestor', 'montador') then
    raise exception 'Sem permissão para decidir a assistência.';
  end if;
  if p_decision not in ('nova_lente', 'refazer', 'reparo', 'cliente_aceita', 'cancelar') then
    raise exception 'Decisão inválida.';
  end if;
  if p_decision = 'cancelar' and v_role not in ('admin', 'gestor') then
    raise exception 'Apenas gestor ou administrador cancela uma OS.';
  end if;

  v_label := case p_decision
    when 'nova_lente' then 'Pedir nova lente'
    when 'refazer' then 'Refazer a montagem'
    when 'reparo' then 'Reparo no laboratório'
    when 'cliente_aceita' then 'Cliente aceitou como está'
    else 'Cancelar a OS'
  end;

  update public.quality_occurrences
  set decision = p_decision,
      decision_note = nullif(trim(coalesce(p_note, '')), ''),
      decided_at = now(),
      decided_by = auth.uid(),
      corrective_action = coalesce(corrective_action, v_label),
      status = case
        when p_decision in ('cliente_aceita', 'cancelar') then 'resolvida'
        else 'em_tratamento'
      end,
      closed_at = case when p_decision in ('cliente_aceita', 'cancelar') then now() else null end
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'Ocorrência não encontrada.';
  end if;

  insert into public.quality_actions (occurrence_id, description, status, user_id)
  values (v_row.id, 'Decisão: ' || v_label || coalesce(' — ' || nullif(trim(coalesce(p_note, '')), ''), ''), v_row.status, auth.uid());

  select * into v_order from public.service_orders where id = v_row.order_id for update;

  if p_decision = 'nova_lente' and v_order.status not in ('entregue', 'cancelado', 'aguardando_lentes') then
    perform set_config('app.status_write', 'on', true);
    update public.service_orders
    set status = 'aguardando_lentes',
        completed_at = null,
        lens_expected_at = coalesce(p_lens_expected_at, lens_expected_at),
        updated_by = auth.uid()
    where id = v_order.id;
    insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
    values (v_order.id, v_order.status, 'aguardando_lentes', 'BO: nova lente solicitada', auth.uid());
  elsif p_decision = 'nova_lente' and p_lens_expected_at is not null then
    update public.service_orders set lens_expected_at = p_lens_expected_at where id = v_order.id;
  elsif p_decision = 'cancelar' and v_order.status not in ('entregue', 'cancelado') then
    perform set_config('app.status_write', 'on', true);
    update public.service_orders set status = 'cancelado', updated_by = auth.uid() where id = v_order.id;
    insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
    values (v_order.id, v_order.status, 'cancelado', 'BO: OS cancelada', auth.uid());
  end if;

  return v_row;
end;
$$;

grant execute on function public.mark_occurrence_notified(uuid) to authenticated;
grant execute on function public.decide_occurrence(uuid, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Rotina do dia: checklist de abertura/fechamento e chegada do motoboy
-- ---------------------------------------------------------------------------

create table if not exists public.routine_logs (
  id uuid primary key default gen_random_uuid(),
  day date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  kind text not null check (kind in ('checklist', 'motoboy', 'nota')),
  item_key text,
  label text not null check (char_length(label) between 1 and 200),
  lenses_count integer check (lenses_count is null or lenses_count between 0 and 999),
  notes text check (notes is null or char_length(notes) <= 1000),
  done_at timestamptz not null default now(),
  done_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists routine_logs_day_idx on public.routine_logs (day, done_at);
create unique index if not exists routine_logs_check_uidx on public.routine_logs (day, item_key) where kind = 'checklist';

alter table public.routine_logs enable row level security;

drop policy if exists routine_select on public.routine_logs;
create policy routine_select on public.routine_logs
  for select to authenticated using (public.current_app_role() is not null);
drop policy if exists routine_insert on public.routine_logs;
create policy routine_insert on public.routine_logs
  for insert to authenticated
  with check (public.current_app_role() in ('admin', 'gestor', 'montador', 'estoquista'));
drop policy if exists routine_delete on public.routine_logs;
create policy routine_delete on public.routine_logs
  for delete to authenticated
  using (public.current_app_role() in ('admin', 'gestor') or done_by = auth.uid());

grant select, insert, delete on public.routine_logs to authenticated, service_role;
grant select, insert, update, delete on public.service_orders to authenticated, service_role;
