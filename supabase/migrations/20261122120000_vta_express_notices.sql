-- Additive only. No updates or deletes of existing orders. Existing NULLs preserve legacy flows.
begin;
set local lock_timeout = '5s';
alter table public.service_orders
 add column if not exists frame_state text check (frame_state in ('unknown','present','vta')),
 add column if not exists express_minutes integer check (express_minutes in (20,40,60)),
 add column if not exists express_started_at timestamptz,
 add column if not exists express_finished_at timestamptz;

create or replace function public.guard_order_operations() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.frame_state='vta' and new.status not in ('aguardando_lentes','cancelado') then
   raise exception 'VTA: registre a chegada da armação antes de encaminhar à montagem.';
 end if;
 if TG_OP='INSERT' then
   new.express_started_at:=null;new.express_finished_at:=null;
 end if;
 if TG_OP='UPDATE' then
   if old.express_started_at is not null and new.express_minutes is distinct from old.express_minutes then
     raise exception 'A duração não pode mudar depois de iniciar a montagem.';
   end if;
   new.express_started_at := old.express_started_at;
   new.express_finished_at := old.express_finished_at;
   if new.status='em_montagem' and old.status is distinct from new.status and new.express_minutes is not null then
     new.express_started_at := coalesce(old.express_started_at,clock_timestamp());
   end if;
   if new.express_started_at is not null and new.status in ('em_conferencia','pronto','entregue','cancelado') and old.status is distinct from new.status then
     new.express_finished_at := coalesce(old.express_finished_at,clock_timestamp());
   end if;
 end if;
 return new;
end; $$;
create or replace trigger orders_operations_guard before insert or update on public.service_orders
 for each row execute function public.guard_order_operations();

create or replace function public.configure_order_operations(p_order_id uuid,p_frame_state text,p_express_minutes integer,p_expected_updated_at timestamptz default null)
returns public.service_orders language plpgsql security definer set search_path=public as $$
declare o public.service_orders;
begin
 if coalesce(public.current_app_role(),'') not in ('admin','gestor','montador') then raise exception 'Sem permissão.'; end if;
 if p_frame_state is null or p_frame_state not in ('unknown','present','vta') then raise exception 'Situação da armação inválida.'; end if;
 if p_express_minutes is not null and p_express_minutes not in (20,40,60) then raise exception 'Escolha 20, 40 ou 60 minutos.'; end if;
 select * into o from public.service_orders where id=p_order_id for update;
 if not found then raise exception 'OS não encontrada.'; end if;
 if o.status in ('pronto','entregue','cancelado') then raise exception 'Serviço encerrado ou liberado. Consulte o histórico.'; end if;
 if p_expected_updated_at is not null and o.updated_at<>p_expected_updated_at then raise exception 'A OS foi atualizada por outra pessoa. Atualize a tela antes de salvar.'; end if;
 if o.frame_state='vta' and p_frame_state<>'vta' then raise exception 'Use Receber armação para confirmar a chegada física.'; end if;
 if o.express_minutes is distinct from p_express_minutes and o.status not in ('aguardando_lentes','aguardando_montagem') then raise exception 'Escolha o tempo expresso antes de começar a montagem.'; end if;
 if o.frame_state is not distinct from p_frame_state and o.express_minutes is not distinct from p_express_minutes then return o; end if;
 update public.service_orders set frame_state=p_frame_state,express_minutes=p_express_minutes,updated_by=auth.uid() where id=p_order_id returning * into o;
 insert into public.order_status_history(order_id,from_status,to_status,note,user_id)
 values(o.id,o.status,o.status,'Armação: '||p_frame_state||' · montagem: '||coalesce(p_express_minutes::text||' minutos','normal'),auth.uid());
 return o;
end; $$;

create or replace function public.create_service_order_configured(p_order jsonb,p_frame_state text,p_express_minutes integer)
returns public.service_orders language plpgsql security definer set search_path=public as $$
declare o public.service_orders;
begin
 if coalesce(public.current_app_role(),'') not in ('admin','gestor','montador') then raise exception 'Sem permissão.'; end if;
 if coalesce(p_frame_state,'unknown') not in ('unknown','present','vta') then raise exception 'Situação da armação inválida.'; end if;
 if p_express_minutes is not null and p_express_minutes not in (20,40,60) then raise exception 'Escolha 20, 40 ou 60 minutos.'; end if;
 if p_express_minutes is not null and coalesce(p_frame_state,'unknown')='vta' then raise exception 'Receba a armação antes de lançar a montagem expressa.'; end if;
 select * into o from public.create_service_order(
  p_order->>'p_client_name',nullif(p_order->>'p_seller_id','')::uuid,(p_order->>'p_laboratory_id')::uuid,
  (p_order->>'p_entered_at')::timestamptz,nullif(p_order->>'p_due_at','')::timestamptz,
  p_order->>'p_notes',p_order->>'p_service_description',p_order->>'p_external_order_id',
  p_order->>'p_priority',case when p_express_minutes is not null then 'aguardando_montagem' else p_order->>'p_status' end,
  coalesce(p_order->'p_lens_spec','{}'::jsonb),nullif(p_order->>'p_store_id','')::uuid);
 update public.service_orders set frame_state=coalesce(p_frame_state,'unknown'),express_minutes=p_express_minutes where id=o.id returning * into o;
 return o;
end; $$;

create or replace function public.receive_order_lenses(p_order_id uuid) returns public.service_orders
language plpgsql security definer set search_path=public as $$
declare o public.service_orders;
begin
 if coalesce(public.current_app_role(),'') not in ('admin','gestor','montador') then raise exception 'Sem permissão.'; end if;
 select * into o from public.service_orders where id=p_order_id for update;
 if not found then raise exception 'OS não encontrada.'; end if;
 if o.status<>'aguardando_lentes' then raise exception 'Este serviço já saiu da fila de lentes. Confira a situação atual.'; end if;
 if o.lens_arrived_at is not null and o.frame_state='vta' then return o; end if;
 update public.service_orders set lens_arrived_at=coalesce(lens_arrived_at,clock_timestamp()),updated_by=auth.uid() where id=o.id returning * into o;
 if o.frame_state='vta' then
   insert into public.order_status_history(order_id,from_status,to_status,note,user_id) values(o.id,o.status,o.status,'Lentes recebidas · VTA: aguardando armação do cliente. Avisar a vendedora.',auth.uid());
 else
   select * into o from public.change_order_status(o.id,'aguardando_montagem','Lentes recebidas e encaminhadas à bancada');
 end if;
 return o;
end; $$;

create or replace function public.receive_order_frame(p_order_id uuid,p_express_minutes integer default null) returns public.service_orders
language plpgsql security definer set search_path=public as $$
declare o public.service_orders;
begin
 if coalesce(public.current_app_role(),'') not in ('admin','gestor','montador') then raise exception 'Sem permissão.'; end if;
 if p_express_minutes is not null and p_express_minutes not in (20,40,60) then raise exception 'Escolha 20, 40 ou 60 minutos.'; end if;
 select * into o from public.service_orders where id=p_order_id for update;
 if not found then raise exception 'OS não encontrada.'; end if;
 if o.frame_state is distinct from 'vta' or o.status<>'aguardando_lentes' then raise exception 'Esta OS não está aguardando a armação. Atualize a tela.'; end if;
 update public.service_orders set frame_state='present',express_minutes=coalesce(p_express_minutes,express_minutes),updated_by=auth.uid() where id=o.id returning * into o;
 insert into public.order_status_history(order_id,from_status,to_status,note,user_id) values(o.id,o.status,o.status,'Armação recebida do cliente'||case when p_express_minutes is not null then ' · expressa '||p_express_minutes||' minutos' else '' end,auth.uid());
 if o.lens_arrived_at is not null then
   select * into o from public.change_order_status(o.id,'aguardando_montagem','Lentes e armação disponíveis: encaminhada à bancada');
 end if;
 return o;
end; $$;

create table if not exists public.order_notice_logs(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.service_orders(id),
 notice_kind text not null check(notice_kind in ('ready','received','lenses','vta','due','missing_ref')),
 event_at timestamptz not null, recipient text not null check(recipient in ('seller','client')),
 notified_at timestamptz not null default now(), notified_by uuid not null references auth.users(id),
 unique(order_id,notice_kind,event_at,recipient)
);
alter table public.order_notice_logs enable row level security;
do $$begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='order_notice_logs' and policyname='notice_logs_read') then
   create policy notice_logs_read on public.order_notice_logs for select to authenticated using(public.current_app_role() is not null);
 end if;
end$$;
grant select on public.order_notice_logs to authenticated;
create or replace function public.mark_order_notice(p_order_id uuid,p_kind text,p_event_at timestamptz,p_recipient text)
returns void language plpgsql security definer set search_path=public as $$
declare o public.service_orders; expected_event timestamptz;
begin
 if coalesce(public.current_app_role(),'') not in ('admin','gestor','montador') then raise exception 'Sem permissão.'; end if;
 if p_kind not in ('ready','received','lenses','vta','due','missing_ref') or p_recipient not in ('seller','client') or p_event_at is null then raise exception 'Aviso inválido.'; end if;
 select * into o from public.service_orders where id=p_order_id;
 if not found then raise exception 'OS não encontrada.'; end if;
 expected_event:=case when p_kind='ready' then o.completed_at when p_kind in ('lenses','vta') then o.lens_arrived_at when p_kind='due' then o.due_at else o.entered_at end;
 if expected_event is distinct from p_event_at then raise exception 'O evento da OS mudou. Atualize a lista antes de confirmar o aviso.'; end if;
 insert into public.order_notice_logs(order_id,notice_kind,event_at,recipient,notified_by) values(p_order_id,p_kind,p_event_at,p_recipient,auth.uid()) on conflict(order_id,notice_kind,event_at,recipient) do nothing;
end; $$;

revoke all on function public.configure_order_operations(uuid,text,integer,timestamptz) from public,anon;
revoke all on function public.create_service_order_configured(jsonb,text,integer) from public,anon;
revoke all on function public.receive_order_lenses(uuid) from public,anon;
revoke all on function public.receive_order_frame(uuid,integer) from public,anon;
revoke all on function public.mark_order_notice(uuid,text,timestamptz,text) from public,anon;
grant execute on function public.configure_order_operations(uuid,text,integer,timestamptz),public.create_service_order_configured(jsonb,text,integer),public.receive_order_lenses(uuid),public.receive_order_frame(uuid,integer),public.mark_order_notice(uuid,text,timestamptz,text) to authenticated;

create or replace function public.seller_app_login(p_login text, p_pin text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller public.sellers;
  v_token text;
  v_hash text;
  v_code text;
begin
  if p_ip_hash is not null and length(p_ip_hash) >= 8 then
    perform public.portal_rate_hit('seller-login:' || p_ip_hash, 20, interval '10 minutes');
  end if;
  if p_pin is null or char_length(p_pin) < 4 or octet_length(p_pin) > 64 or btrim(p_pin) = '' then
    raise exception 'Código ou senha inválidos.';
  end if;
  v_code := lower(btrim(coalesce(p_login, '')));
  if v_code ~ '^v?[0-9]{1,3}$' then
    v_code := regexp_replace(v_code, '^v', '');
    select * into v_seller from public.sellers where quick_code = v_code::int and active limit 1;
  elsif position('@' in v_code)>0 then
    select * into v_seller from public.sellers where lower(coalesce(email, '')) = v_code and active limit 1;
  else
    if (select count(*) from public.sellers where lower(btrim(name))=v_code and active)<>1 then
      raise exception 'Código ou senha inválidos.';
    end if;
    select * into v_seller from public.sellers where lower(btrim(name))=v_code and active;
  end if;
  if not found or v_seller.access_pin_hash is null then
    raise exception 'Código ou senha inválidos.';
  end if;
  if v_seller.access_pin_hash <> extensions.crypt(p_pin, v_seller.access_pin_hash) then
    raise exception 'Código ou senha inválidos.';
  end if;

  update public.portal_credentials
  set revoked_at = now()
  where seller_id = v_seller.id and access_kind = 'app' and revoked_at is null;

  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  insert into public.portal_credentials (
    subject_type, seller_id, token_hash, token_prefix, access_kind
  ) values (
    'seller', v_seller.id, v_hash, left(v_token, 6), 'app'
  );

  return jsonb_build_object(
    'token', v_token,
    'kind', 'vendedor',
    'name', v_seller.name,
    'login', 'v' || v_seller.quick_code::text
  );
end;
$$;

commit;
