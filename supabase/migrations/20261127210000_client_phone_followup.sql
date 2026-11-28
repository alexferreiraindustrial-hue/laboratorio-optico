-- Telefone do cliente na OS e pós-venda automático na saída.
-- Aditiva: cria uma coluna nova (vazia) e duas funções. Não altera OS, colunas nem histórico existentes.
begin;
set local lock_timeout = '5s';

alter table public.service_orders
  add column if not exists client_phone text;

do $$begin
  if not exists (select 1 from pg_constraint where conname = 'service_orders_client_phone_check') then
    alter table public.service_orders
      add constraint service_orders_client_phone_check check (client_phone is null or client_phone ~ '^[0-9]{10,15}$');
  end if;
end$$;

-- Grava (ou limpa) o WhatsApp do cliente da OS e registra no histórico.
create or replace function public.set_order_client_phone(p_order_id uuid, p_phone text)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.service_orders;
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
begin
  if auth.uid() is null or coalesce(public.current_app_role(), '') not in ('admin', 'gestor', 'montador') then
    raise exception 'Seu acesso não altera o telefone do cliente.';
  end if;
  if v_phone is not null and length(v_phone) not between 10 and 15 then
    raise exception 'Confira o telefone do cliente com DDD.';
  end if;
  select * into o from public.service_orders where id = p_order_id for update;
  if not found then
    raise exception 'OS não encontrada.';
  end if;
  if o.client_phone is not distinct from v_phone then
    return o;
  end if;
  update public.service_orders set client_phone = v_phone where id = o.id returning * into o;
  insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
  values (o.id, o.status, o.status,
    case when v_phone is null then 'Telefone do cliente removido' else 'Telefone do cliente atualizado' end,
    auth.uid());
  return o;
end;
$$;

-- Quando a OS com número da loja sai do laboratório (entregue), entra no pós-venda
-- com retorno previsto para cinco dias. Não faz nada se já estiver no pós-venda.
create or replace function public.ensure_client_followup(p_order_id uuid)
returns public.client_delivery_followups
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.service_orders;
  d public.client_delivery_followups;
begin
  if auth.uid() is null or coalesce(public.current_app_role(), '') not in ('admin', 'gestor', 'montador') then
    raise exception 'Seu acesso não registra o pós-venda.';
  end if;
  select * into d from public.client_delivery_followups where order_id = p_order_id;
  if found then
    return d;
  end if;
  select * into o from public.service_orders where id = p_order_id;
  if not found or o.status <> 'entregue' then
    return null;
  end if;
  if nullif(trim(coalesce(o.external_order_id, '')), '') is null and o.number ~ '^OS-[0-9]{4}-[0-9]+$' then
    return null;
  end if;
  insert into public.client_delivery_followups (order_id, client_delivered_at, followup_due_at, client_phone, confirmed_by)
  values (o.id, clock_timestamp(), clock_timestamp() + interval '120 hours', o.client_phone, auth.uid())
  on conflict (order_id) do nothing
  returning * into d;
  if d.id is not null then
    insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
    values (o.id, o.status, o.status, 'Saiu do laboratório: entrou no pós-venda (contato após cinco dias).', auth.uid());
  end if;
  return d;
end;
$$;

revoke all on function public.set_order_client_phone(uuid, text) from public, anon;
grant execute on function public.set_order_client_phone(uuid, text) to authenticated;
revoke all on function public.ensure_client_followup(uuid) from public, anon;
grant execute on function public.ensure_client_followup(uuid) to authenticated;

commit;
