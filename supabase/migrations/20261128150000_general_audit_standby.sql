-- Auditoria geral "do zero": ao iniciar, todas as OS em aberto vão para standby (off) na hora;
-- cada OS volta a ficar ativa quando é bipada (na posição bipada). Dá para cancelar e reativar todas.
-- Aditiva: uma coluna nova em audit_sessions e funções novas. Não altera nem apaga dados das OS.
begin;
set local lock_timeout = '5s';

alter table public.audit_sessions add column if not exists standby boolean not null default false;

-- Inicia a auditoria colocando todas as OS em aberto em standby.
create or replace function public.start_general_audit_standby()
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
  insert into public.audit_sessions (started_by, standby) values (auth.uid(), true) returning * into s;
  insert into public.audit_session_orders (session_id, order_id, status_at_start)
  select s.id, o.id, o.status from public.service_orders o
  where o.status not in ('entregue', 'cancelado') and o.audit_off_at is null;
  update public.service_orders o
  set audit_off_at = now(), audit_off_by = auth.uid()
  from public.audit_session_orders a
  where a.session_id = s.id and a.order_id = o.id;
  insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
  select a.order_id, a.status_at_start, a.status_at_start, 'Auditoria geral: em standby até ser bipada', auth.uid()
  from public.audit_session_orders a where a.session_id = s.id;
  return s;
end;
$$;

-- Encerra: no modo standby, as não bipadas já estão em off e continuam assim.
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
  )
  insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
  select id, status, status, 'Auditoria geral: não encontrada no laboratório, colocada em off (dados guardados)', auth.uid() from chosen;
  select count(*) into n from public.audit_session_orders a join public.service_orders o on o.id = a.order_id
  where a.session_id = s.id and a.found_at is null and o.audit_off_at is not null;
  update public.audit_sessions set finished_at = now(), finished_by = auth.uid(), off_count = n where id = s.id returning * into s;
  return s;
end;
$$;

-- Cancela a auditoria aberta: reativa as OS que esta auditoria colocou em off e ainda não foram bipadas.
create or replace function public.cancel_general_audit()
returns public.audit_sessions
language plpgsql security definer set search_path = public as $$
declare
  s public.audit_sessions;
begin
  if auth.uid() is null or coalesce(public.current_app_role(), '') not in ('admin', 'gestor') then
    raise exception 'Somente administrador ou gestor cancela a auditoria geral.';
  end if;
  select * into s from public.audit_sessions where finished_at is null for update;
  if not found then
    raise exception 'Não há auditoria geral aberta.';
  end if;
  with revived as (
    update public.service_orders o
    set audit_off_at = null, audit_off_by = null
    from public.audit_session_orders a
    where a.session_id = s.id and a.order_id = o.id and a.found_at is null
      and o.audit_off_at is not null and o.audit_off_at >= s.started_at
    returning o.id, o.status
  )
  insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
  select id, status, status, 'Auditoria geral cancelada: OS reativada', auth.uid() from revived;
  update public.audit_sessions set finished_at = now(), finished_by = auth.uid(), off_count = 0 where id = s.id returning * into s;
  return s;
end;
$$;

revoke all on function public.start_general_audit_standby() from public, anon;
revoke all on function public.cancel_general_audit() from public, anon;
grant execute on function public.start_general_audit_standby() to authenticated;
grant execute on function public.cancel_general_audit() to authenticated;

commit;
