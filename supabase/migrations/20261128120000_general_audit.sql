-- Auditoria geral: confere fisicamente todas as OS em aberto e coloca em "off" as que não foram encontradas.
-- Aditiva: uma coluna nova (vazia), duas tabelas novas, funções novas e um filtro na visão orders_enriched
-- para esconder as OS em off da operação. Nenhuma OS, coluna ou histórico existente é alterado ou apagado.
-- A visão orders_enriched_all (nova) continua mostrando tudo, inclusive as OS em off.
begin;
set local lock_timeout = '5s';

alter table public.service_orders add column if not exists audit_off_at timestamptz;
alter table public.service_orders add column if not exists audit_off_by uuid references auth.users(id);

create table if not exists public.audit_sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  started_by uuid not null references auth.users(id),
  finished_at timestamptz,
  finished_by uuid references auth.users(id),
  off_count integer not null default 0
);
create unique index if not exists audit_sessions_one_open on public.audit_sessions ((true)) where finished_at is null;

create table if not exists public.audit_session_orders (
  session_id uuid not null references public.audit_sessions(id),
  order_id uuid not null references public.service_orders(id),
  status_at_start text,
  found_at timestamptz,
  found_position text,
  found_by uuid references auth.users(id),
  primary key (session_id, order_id)
);

alter table public.audit_sessions enable row level security;
alter table public.audit_session_orders enable row level security;
drop policy if exists audit_sessions_read on public.audit_sessions;
create policy audit_sessions_read on public.audit_sessions for select to authenticated using (public.current_app_role() is not null);
drop policy if exists audit_session_orders_read on public.audit_session_orders;
create policy audit_session_orders_read on public.audit_session_orders for select to authenticated using (public.current_app_role() is not null);
revoke all on public.audit_sessions, public.audit_session_orders from anon, authenticated;
grant select on public.audit_sessions, public.audit_session_orders to authenticated;

-- Visões: orders_enriched_all = como era (tudo); orders_enriched passa a esconder as OS em off.
do $$
declare
  def text;
begin
  def := rtrim(pg_get_viewdef('public.orders_enriched'::regclass), E' ;\n');
  if def ~* '\mwhere\M' then
    raise exception 'orders_enriched já tem filtro; revise antes de aplicar.';
  end if;
  execute 'create or replace view public.orders_enriched_all with (security_invoker = true) as ' || def;
  execute 'create or replace view public.orders_enriched with (security_invoker = true) as ' || def || ' WHERE o.audit_off_at IS NULL';
end$$;
grant select on public.orders_enriched_all to authenticated, service_role;

-- Inicia a auditoria: anota as OS em aberto como "a conferir". Não muda nenhuma OS.
create or replace function public.start_general_audit()
returns public.audit_sessions
language plpgsql security definer set search_path = public as $$
declare
  s public.audit_sessions;
begin
  if auth.uid() is null or coalesce(public.current_app_role(), '') not in ('admin', 'gestor') then
    raise exception 'Somente administrador ou gestor inicia a auditoria geral.';
  end if;
  select * into s from public.audit_sessions where finished_at is null;
  if found then
    return s;
  end if;
  insert into public.audit_sessions (started_by) values (auth.uid()) returning * into s;
  insert into public.audit_session_orders (session_id, order_id, status_at_start)
  select s.id, o.id, o.status from public.service_orders o
  where o.status not in ('entregue', 'cancelado') and o.audit_off_at is null;
  return s;
end;
$$;

-- Registra a OS bipada na auditoria aberta e, se estava em off, volta a ficar ativa.
create or replace function public.audit_mark_found(p_order_id uuid, p_position text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.service_orders;
  s public.audit_sessions;
begin
  if auth.uid() is null or coalesce(public.current_app_role(), '') not in ('admin', 'gestor', 'montador') then
    raise exception 'Seu acesso não registra a auditoria.';
  end if;
  select * into o from public.service_orders where id = p_order_id for update;
  if not found then
    raise exception 'OS não encontrada.';
  end if;
  if o.audit_off_at is not null then
    update public.service_orders set audit_off_at = null, audit_off_by = null where id = o.id;
    insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
    values (o.id, o.status, o.status, 'Auditoria: OS encontrada, voltou a ficar ativa', auth.uid());
  end if;
  select * into s from public.audit_sessions where finished_at is null;
  if found then
    insert into public.audit_session_orders (session_id, order_id, status_at_start, found_at, found_position, found_by)
    values (s.id, o.id, o.status, now(), p_position, auth.uid())
    on conflict (session_id, order_id) do update
      set found_at = coalesce(audit_session_orders.found_at, excluded.found_at),
          found_position = excluded.found_position,
          found_by = excluded.found_by;
  end if;
end;
$$;

-- Encerra a auditoria colocando em off só as OS escolhidas (não encontradas). As outras ficam como estão.
create or replace function public.finish_general_audit(p_off_ids uuid[])
returns public.audit_sessions
language plpgsql security definer set search_path = public as $$
declare
  s public.audit_sessions;
  n integer := 0;
begin
  if auth.uid() is null or coalesce(public.current_app_role(), '') not in ('admin', 'gestor') then
    raise exception 'Somente administrador ou gestor encerra a auditoria geral.';
  end if;
  select * into s from public.audit_sessions where finished_at is null for update;
  if not found then
    raise exception 'Não há auditoria geral aberta.';
  end if;
  with chosen as (
    update public.service_orders o
    set audit_off_at = now(), audit_off_by = auth.uid()
    from public.audit_session_orders a
    where a.session_id = s.id and a.order_id = o.id and a.found_at is null
      and o.id = any(coalesce(p_off_ids, '{}'::uuid[])) and o.audit_off_at is null
      and o.status not in ('entregue', 'cancelado')
    returning o.id, o.status
  ), logged as (
    insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
    select id, status, status, 'Auditoria geral: não encontrada no laboratório, colocada em off (dados guardados)', auth.uid() from chosen
    returning 1
  )
  select count(*) into n from logged;
  update public.audit_sessions set finished_at = now(), finished_by = auth.uid(), off_count = n where id = s.id returning * into s;
  return s;
end;
$$;

-- Reativa uma OS em off (sem mudar etapa).
create or replace function public.reactivate_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.service_orders;
begin
  if auth.uid() is null or coalesce(public.current_app_role(), '') not in ('admin', 'gestor', 'montador') then
    raise exception 'Seu acesso não reativa OS.';
  end if;
  select * into o from public.service_orders where id = p_order_id for update;
  if not found then
    raise exception 'OS não encontrada.';
  end if;
  if o.audit_off_at is null then
    return;
  end if;
  update public.service_orders set audit_off_at = null, audit_off_by = null where id = o.id;
  insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
  values (o.id, o.status, o.status, 'OS reativada (estava em off pela auditoria)', auth.uid());
end;
$$;

-- Portal da vendedora: diz quais OS da lista estão em off, para não aparecerem.
create or replace function public.portal_hidden_orders(p_ids uuid[])
returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.service_orders where id = any(coalesce(p_ids, '{}'::uuid[])) and audit_off_at is not null;
$$;

revoke all on function public.start_general_audit() from public, anon;
revoke all on function public.audit_mark_found(uuid, text) from public, anon;
revoke all on function public.finish_general_audit(uuid[]) from public, anon;
revoke all on function public.reactivate_order(uuid) from public, anon;
revoke all on function public.portal_hidden_orders(uuid[]) from public;
grant execute on function public.start_general_audit() to authenticated;
grant execute on function public.audit_mark_found(uuid, text) to authenticated;
grant execute on function public.finish_general_audit(uuid[]) to authenticated;
grant execute on function public.reactivate_order(uuid) to authenticated;
grant execute on function public.portal_hidden_orders(uuid[]) to anon, authenticated;

commit;
