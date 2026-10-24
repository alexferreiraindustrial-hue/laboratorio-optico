-- Lojas, vendedores vinculados, portal externo e recados.
-- Não apaga ordens, vendedores nem laboratórios existentes.

create extension if not exists pgcrypto;

alter table public.sellers
  add column if not exists public_code text,
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists email text;

update public.sellers
set public_code = 'VD-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where public_code is null;

alter table public.sellers
  alter column public_code set not null;

create unique index if not exists sellers_public_code_uidx on public.sellers (public_code);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  trade_name text not null,
  legal_name text,
  cnpj text,
  contact_name text,
  phone text,
  whatsapp text,
  email text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_cnpj_digits check (cnpj is null or cnpj ~ '^[0-9]{14}$')
);

create table if not exists public.seller_stores (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (seller_id, store_id)
);

create index if not exists seller_stores_store_idx on public.seller_stores (store_id);

alter table public.service_orders
  add column if not exists store_id uuid references public.stores (id);

create index if not exists service_orders_store_idx on public.service_orders (store_id);

create table if not exists public.portal_credentials (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('store', 'seller')),
  store_id uuid references public.stores (id),
  seller_id uuid references public.sellers (id),
  token_hash text not null unique,
  token_prefix text not null,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_credentials_subject check (
    (subject_type = 'store' and store_id is not null and seller_id is null)
    or (subject_type = 'seller' and seller_id is not null and store_id is null)
  )
);

create index if not exists portal_credentials_store_idx on public.portal_credentials (store_id) where revoked_at is null;
create index if not exists portal_credentials_seller_idx on public.portal_credentials (seller_id) where revoked_at is null;

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders (id) on delete restrict,
  store_id uuid references public.stores (id),
  seller_id uuid references public.sellers (id),
  credential_id uuid references public.portal_credentials (id),
  sender_kind text not null check (sender_kind in ('store', 'seller')),
  sender_label text not null,
  body text not null,
  status text not null default 'novo' check (status in ('novo', 'visualizado', 'respondido')),
  viewed_at timestamptz,
  viewed_by uuid references public.profiles (id),
  reply_body text,
  replied_at timestamptz,
  replied_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_messages_body_len check (char_length(body) between 5 and 800),
  constraint order_messages_reply_len check (reply_body is null or char_length(reply_body) between 1 and 800)
);

create index if not exists order_messages_order_idx on public.order_messages (order_id, created_at);
create index if not exists order_messages_status_idx on public.order_messages (status, created_at desc);

create table if not exists public.portal_rate_buckets (
  bucket text primary key,
  hits integer not null default 0,
  window_start timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Códigos e integridade
-- ---------------------------------------------------------------------------

create or replace function public.assign_party_code()
returns trigger
language plpgsql
as $$
declare
  v_prefix text := case tg_table_name when 'stores' then 'LJ-' else 'VD-' end;
begin
  if new.public_code is null or btrim(new.public_code) = '' then
    new.public_code := v_prefix || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
  end if;
  return new;
end;
$$;

drop trigger if exists stores_code on public.stores;
create trigger stores_code before insert on public.stores
  for each row execute function public.assign_party_code();

drop trigger if exists sellers_code on public.sellers;
create trigger sellers_code before insert on public.sellers
  for each row execute function public.assign_party_code();

create or replace function public.prevent_party_delete()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'stores' and (
    exists (select 1 from public.service_orders where store_id = old.id)
    or exists (select 1 from public.seller_stores where store_id = old.id)
    or exists (select 1 from public.order_messages where store_id = old.id)
  ) then
    raise exception 'Esta loja possui histórico e não pode ser excluída. Desative o cadastro.';
  end if;
  if tg_table_name = 'sellers' and (
    exists (select 1 from public.service_orders where seller_id = old.id)
    or exists (select 1 from public.order_messages where seller_id = old.id)
  ) then
    raise exception 'Este vendedor possui histórico e não pode ser excluído. Desative o cadastro.';
  end if;
  return old;
end;
$$;

drop trigger if exists stores_no_delete on public.stores;
create trigger stores_no_delete before delete on public.stores
  for each row execute function public.prevent_party_delete();

drop trigger if exists sellers_no_delete on public.sellers;
create trigger sellers_no_delete before delete on public.sellers
  for each row execute function public.prevent_party_delete();

create or replace function public.guard_message_body()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and (
    new.body is distinct from old.body
    or new.order_id is distinct from old.order_id
    or new.sender_kind is distinct from old.sender_kind
    or new.store_id is distinct from old.store_id
    or new.seller_id is distinct from old.seller_id
  ) then
    raise exception 'Um recado enviado não pode ser editado nem transferido.';
  end if;
  return new;
end;
$$;

drop trigger if exists order_messages_guard on public.order_messages;
create trigger order_messages_guard before update on public.order_messages
  for each row execute function public.guard_message_body();

drop trigger if exists stores_touch on public.stores;
create trigger stores_touch before update on public.stores
  for each row execute function public.touch_updated_at();

drop trigger if exists portal_credentials_touch on public.portal_credentials;
create trigger portal_credentials_touch before update on public.portal_credentials
  for each row execute function public.touch_updated_at();

drop trigger if exists order_messages_touch on public.order_messages;
create trigger order_messages_touch before update on public.order_messages
  for each row execute function public.touch_updated_at();

drop trigger if exists stores_audit on public.stores;
create trigger stores_audit after insert or update or delete on public.stores
  for each row execute function public.audit_change();

drop trigger if exists sellers_audit on public.sellers;
create trigger sellers_audit after insert or update or delete on public.sellers
  for each row execute function public.audit_change();

drop trigger if exists seller_stores_audit on public.seller_stores;
create trigger seller_stores_audit after insert or delete on public.seller_stores
  for each row execute function public.audit_change();

create or replace function public.audit_portal_credential()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (user_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    tg_op,
    'portal_credentials',
    coalesce(new.id, old.id),
    jsonb_build_object(
      'subject_type', coalesce(new.subject_type, old.subject_type),
      'store_id', coalesce(new.store_id, old.store_id),
      'seller_id', coalesce(new.seller_id, old.seller_id),
      'token_prefix', coalesce(new.token_prefix, old.token_prefix),
      'revoked', coalesce(new.revoked_at, old.revoked_at) is not null
    )
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists portal_credentials_audit on public.portal_credentials;
create trigger portal_credentials_audit after insert or update on public.portal_credentials
  for each row execute function public.audit_portal_credential();

drop trigger if exists order_messages_audit on public.order_messages;
create trigger order_messages_audit after insert or update on public.order_messages
  for each row execute function public.audit_change();

-- ---------------------------------------------------------------------------
-- Ordens: loja e vendedor
-- ---------------------------------------------------------------------------

create or replace function public.assert_order_parties(
  p_store_id uuid,
  p_seller_id uuid,
  p_previous_store uuid,
  p_previous_seller uuid
)
returns void
language plpgsql
stable
as $$
begin
  if p_store_id is not null and p_store_id is distinct from p_previous_store then
    if not exists (select 1 from public.stores where id = p_store_id and active) then
      raise exception 'A loja está inativa ou não existe.';
    end if;
  end if;
  if p_seller_id is not null and p_seller_id is distinct from p_previous_seller then
    if not exists (select 1 from public.sellers where id = p_seller_id and active) then
      raise exception 'O vendedor está inativo ou não existe.';
    end if;
  end if;
  if p_store_id is not null and p_seller_id is not null
     and (p_store_id is distinct from p_previous_store or p_seller_id is distinct from p_previous_seller) then
    if not exists (
      select 1 from public.seller_stores
      where store_id = p_store_id and seller_id = p_seller_id
    ) then
      raise exception 'O vendedor não está vinculado a esta loja.';
    end if;
  end if;
end;
$$;

drop function if exists public.create_service_order(text, uuid, uuid, timestamptz, timestamptz, text, text, text, text, text, jsonb);

create or replace function public.create_service_order(
  p_client_name text,
  p_seller_id uuid,
  p_laboratory_id uuid,
  p_entered_at timestamptz,
  p_due_at timestamptz,
  p_notes text,
  p_service_description text,
  p_external_order_id text,
  p_priority text,
  p_status text,
  p_lens_spec jsonb,
  p_store_id uuid default null
)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_order public.service_orders;
  v_external text := nullif(trim(coalesce(p_external_order_id, '')), '');
begin
  if v_role not in ('admin', 'gestor', 'montador') then
    raise exception 'Sem permissão para cadastrar OS.';
  end if;
  if nullif(trim(coalesce(p_client_name, '')), '') is null then
    raise exception 'Informe o cliente ou a loja.';
  end if;
  if p_laboratory_id is null then
    raise exception 'Selecione o laboratório.';
  end if;
  if nullif(trim(coalesce(p_service_description, '')), '') is null then
    raise exception 'Descreva o serviço.';
  end if;
  if p_due_at is not null and p_due_at < p_entered_at then
    raise exception 'A previsão não pode ser anterior à entrada.';
  end if;
  if coalesce(p_status, 'aguardando_lentes') not in ('aguardando_lentes', 'aguardando_montagem') then
    raise exception 'Uma OS nova começa aguardando lentes ou aguardando montagem.';
  end if;
  if v_external is not null and exists (
    select 1 from public.service_orders where external_order_id = v_external
  ) then
    raise exception 'O pedido externo % já está vinculado a outra OS.', v_external;
  end if;
  perform public.assert_order_parties(p_store_id, p_seller_id, null, null);

  insert into public.service_orders (
    number, client_name, seller_id, store_id, laboratory_id, entered_at, due_at, notes,
    service_description, external_order_id, priority, status, lens_spec, created_by, updated_by
  ) values (
    public.next_os_number(),
    trim(p_client_name),
    p_seller_id,
    p_store_id,
    p_laboratory_id,
    p_entered_at,
    p_due_at,
    nullif(trim(coalesce(p_notes, '')), ''),
    trim(p_service_description),
    v_external,
    coalesce(p_priority, 'normal'),
    coalesce(p_status, 'aguardando_lentes'),
    coalesce(p_lens_spec, '{}'::jsonb),
    auth.uid(),
    auth.uid()
  ) returning * into v_order;

  perform public.ensure_assembly_steps(v_order.id);

  insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
  values (v_order.id, null, v_order.status, 'Abertura da OS', auth.uid());

  return v_order;
end;
$$;

drop function if exists public.update_service_order(uuid, text, uuid, uuid, timestamptz, timestamptz, text, text, text, text, jsonb);

create or replace function public.update_service_order(
  p_order_id uuid,
  p_client_name text,
  p_seller_id uuid,
  p_laboratory_id uuid,
  p_entered_at timestamptz,
  p_due_at timestamptz,
  p_notes text,
  p_service_description text,
  p_external_order_id text,
  p_priority text,
  p_lens_spec jsonb,
  p_store_id uuid default null
)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_order public.service_orders;
  v_old public.service_orders;
  v_external text := nullif(trim(coalesce(p_external_order_id, '')), '');
begin
  if v_role not in ('admin', 'gestor', 'montador') then
    raise exception 'Sem permissão para editar a OS.';
  end if;
  select * into v_old from public.service_orders where id = p_order_id;
  if not found then
    raise exception 'OS não encontrada.';
  end if;
  if p_due_at is not null and p_due_at < p_entered_at then
    raise exception 'A previsão não pode ser anterior à entrada.';
  end if;
  if v_external is not null and exists (
    select 1 from public.service_orders
    where external_order_id = v_external and id <> p_order_id
  ) then
    raise exception 'O pedido externo % já está vinculado a outra OS.', v_external;
  end if;
  perform public.assert_order_parties(p_store_id, p_seller_id, v_old.store_id, v_old.seller_id);

  update public.service_orders
  set
    client_name = trim(p_client_name),
    seller_id = p_seller_id,
    store_id = p_store_id,
    laboratory_id = p_laboratory_id,
    entered_at = p_entered_at,
    due_at = p_due_at,
    notes = nullif(trim(coalesce(p_notes, '')), ''),
    service_description = trim(p_service_description),
    external_order_id = v_external,
    priority = coalesce(p_priority, priority),
    lens_spec = coalesce(p_lens_spec, lens_spec),
    updated_by = auth.uid()
  where id = p_order_id
  returning * into v_order;

  if v_old.store_id is distinct from v_order.store_id or v_old.seller_id is distinct from v_order.seller_id then
    insert into public.audit_logs (user_id, action, entity, entity_id, payload)
    values (
      auth.uid(),
      'vinculo',
      'service_orders',
      v_order.id,
      jsonb_build_object(
        'store_from', v_old.store_id,
        'store_to', v_order.store_id,
        'seller_from', v_old.seller_id,
        'seller_to', v_order.seller_id
      )
    );
  end if;

  return v_order;
end;
$$;

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

-- ---------------------------------------------------------------------------
-- Portal
-- ---------------------------------------------------------------------------

create or replace function public.sanitize_portal_text(p_value text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(coalesce(p_value, ''), '<[^>]*>', '', 'g'),
        '[[:cntrl:]]',
        '',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function public.portal_rate_hit(p_bucket text, p_limit integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
  v_start timestamptz;
begin
  insert into public.portal_rate_buckets (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
  set
    hits = case
      when public.portal_rate_buckets.window_start < now() - p_window then 1
      else public.portal_rate_buckets.hits + 1
    end,
    window_start = case
      when public.portal_rate_buckets.window_start < now() - p_window then now()
      else public.portal_rate_buckets.window_start
    end
  returning hits, window_start into v_hits, v_start;

  if v_hits > p_limit then
    raise exception 'Muitas tentativas. Aguarde alguns minutos.';
  end if;
end;
$$;

create or replace function public.portal_credential(p_token text, p_ip_hash text)
returns public.portal_credentials
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_row public.portal_credentials;
begin
  if p_token is null or length(p_token) < 32 then
    if p_ip_hash is not null and length(p_ip_hash) >= 16 then
      perform public.portal_rate_hit('ip:' || p_ip_hash, 40, interval '10 minutes');
    end if;
    raise exception 'Link inválido.';
  end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select * into v_row from public.portal_credentials where token_hash = v_hash;
  if not found then
    if p_ip_hash is not null and length(p_ip_hash) >= 16 then
      perform public.portal_rate_hit('ip:' || p_ip_hash, 40, interval '10 minutes');
    end if;
    raise exception 'Link inválido.';
  end if;
  if v_row.revoked_at is not null then
    raise exception 'Este link foi revogado.';
  end if;
  if v_row.subject_type = 'store' and not exists (
    select 1 from public.stores where id = v_row.store_id and active
  ) then
    raise exception 'Este link foi revogado.';
  end if;
  if v_row.subject_type = 'seller' and not exists (
    select 1 from public.sellers where id = v_row.seller_id and active
  ) then
    raise exception 'Este link foi revogado.';
  end if;
  update public.portal_credentials set last_used_at = now() where id = v_row.id;
  return v_row;
end;
$$;

create or replace function public.portal_can_see(p_cred public.portal_credentials, p_order public.service_orders)
returns boolean
language sql
stable
as $$
  select case
    when p_cred.subject_type = 'store' then p_order.store_id = p_cred.store_id
    when p_cred.subject_type = 'seller' then p_order.seller_id = p_cred.seller_id
    else false
  end;
$$;

create or replace function public.portal_orders(
  p_token text,
  p_ip_hash text,
  p_query text default '',
  p_seller_id uuid default null,
  p_status text default '',
  p_from date default null,
  p_to date default null,
  p_late boolean default false,
  p_ready boolean default false
)
returns table (
  id uuid,
  number text,
  client_name text,
  external_order_id text,
  seller_name text,
  store_name text,
  entered_at timestamptz,
  due_at timestamptz,
  status text,
  late boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cred public.portal_credentials;
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
begin
  v_cred := public.portal_credential(p_token, p_ip_hash);
  return query
  select
    o.id,
    o.number,
    o.client_name,
    o.external_order_id,
    s.name,
    st.trade_name,
    o.entered_at,
    o.due_at,
    o.status,
    (o.due_at is not null and o.due_at < now() and o.status not in ('entregue', 'cancelado'))
  from public.service_orders o
  left join public.sellers s on s.id = o.seller_id
  left join public.stores st on st.id = o.store_id
  where public.portal_can_see(v_cred, o)
    and (v_query is null or o.number ilike '%' || v_query || '%' or o.client_name ilike '%' || v_query || '%' or coalesce(o.external_order_id, '') ilike '%' || v_query || '%')
    and (p_seller_id is null or o.seller_id = p_seller_id)
    and (nullif(p_status, '') is null or o.status = p_status)
    and (p_from is null or o.entered_at >= p_from::timestamptz)
    and (p_to is null or o.entered_at < (p_to + 1)::timestamptz)
    and (not p_late or (o.due_at is not null and o.due_at < now() and o.status not in ('entregue', 'cancelado')))
    and (not p_ready or o.status = 'pronto')
    and (
      v_cred.subject_type = 'store'
      or p_seller_id is null
      or o.seller_id = v_cred.seller_id
    )
  order by o.entered_at desc
  limit 200;
end;
$$;

create or replace function public.portal_order_detail(p_token text, p_ip_hash text, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cred public.portal_credentials;
  v_order public.service_orders;
  v_seller text;
  v_store text;
begin
  v_cred := public.portal_credential(p_token, p_ip_hash);
  select * into v_order from public.service_orders where id = p_order_id;
  if not found or not public.portal_can_see(v_cred, v_order) then
    raise exception 'OS não encontrada.';
  end if;
  select name into v_seller from public.sellers where id = v_order.seller_id;
  select trade_name into v_store from public.stores where id = v_order.store_id;
  return jsonb_build_object(
    'id', v_order.id,
    'number', v_order.number,
    'client_name', v_order.client_name,
    'external_order_id', v_order.external_order_id,
    'seller_name', v_seller,
    'store_name', v_store,
    'entered_at', v_order.entered_at,
    'due_at', v_order.due_at,
    'status', v_order.status,
    'service_description', v_order.service_description,
    'late', v_order.due_at is not null and v_order.due_at < now() and v_order.status not in ('entregue', 'cancelado'),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from_status', h.from_status,
        'to_status', h.to_status,
        'created_at', h.created_at
      ) order by h.created_at)
      from public.order_status_history h
      where h.order_id = v_order.id
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'sender_kind', m.sender_kind,
        'sender_label', m.sender_label,
        'body', m.body,
        'status', m.status,
        'created_at', m.created_at,
        'reply_body', m.reply_body,
        'replied_at', m.replied_at
      ) order by m.created_at)
      from public.order_messages m
      where m.order_id = v_order.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.portal_send_message(p_token text, p_ip_hash text, p_order_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cred public.portal_credentials;
  v_order public.service_orders;
  v_body text;
  v_label text;
  v_id uuid;
begin
  v_cred := public.portal_credential(p_token, p_ip_hash);
  perform public.portal_rate_hit('msg:' || v_cred.id::text, 8, interval '10 minutes');
  select * into v_order from public.service_orders where id = p_order_id;
  if not found or not public.portal_can_see(v_cred, v_order) then
    raise exception 'OS não encontrada.';
  end if;
  v_body := public.sanitize_portal_text(p_body);
  if v_body is null or char_length(v_body) < 5 or char_length(v_body) > 800 then
    raise exception 'Escreva uma mensagem entre 5 e 800 caracteres.';
  end if;
  if v_cred.subject_type = 'store' then
    select trade_name into v_label from public.stores where id = v_cred.store_id;
  else
    select name into v_label from public.sellers where id = v_cred.seller_id;
  end if;
  insert into public.order_messages (
    order_id, store_id, seller_id, credential_id, sender_kind, sender_label, body
  ) values (
    v_order.id,
    v_order.store_id,
    case when v_cred.subject_type = 'seller' then v_cred.seller_id else v_order.seller_id end,
    v_cred.id,
    v_cred.subject_type,
    coalesce(v_label, 'Portal'),
    v_body
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.portal_identity(p_token text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cred public.portal_credentials;
  v_name text;
begin
  v_cred := public.portal_credential(p_token, p_ip_hash);
  if v_cred.subject_type = 'store' then
    select trade_name into v_name from public.stores where id = v_cred.store_id;
  else
    select name into v_name from public.sellers where id = v_cred.seller_id;
  end if;
  return jsonb_build_object('name', coalesce(v_name, 'Acompanhamento'), 'kind', v_cred.subject_type);
end;
$$;

create or replace function public.portal_sellers(p_token text, p_ip_hash text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cred public.portal_credentials;
begin
  v_cred := public.portal_credential(p_token, p_ip_hash);
  if v_cred.subject_type <> 'store' then
    return;
  end if;
  return query
  select s.id, s.name
  from public.sellers s
  join public.seller_stores link on link.seller_id = s.id
  where link.store_id = v_cred.store_id
  order by s.name;
end;
$$;

create or replace function public.issue_portal_credential(p_subject_type text, p_subject_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_token text;
  v_hash text;
begin
  if v_role not in ('admin', 'gestor') then
    raise exception 'Apenas gestor ou administrador gera links de acompanhamento.';
  end if;
  if p_subject_type not in ('store', 'seller') then
    raise exception 'Tipo de acesso inválido.';
  end if;
  if p_subject_type = 'store' and not exists (select 1 from public.stores where id = p_subject_id) then
    raise exception 'Loja não encontrada.';
  end if;
  if p_subject_type = 'seller' and not exists (select 1 from public.sellers where id = p_subject_id) then
    raise exception 'Vendedor não encontrado.';
  end if;

  update public.portal_credentials
  set revoked_at = now()
  where revoked_at is null
    and (
      (p_subject_type = 'store' and store_id = p_subject_id)
      or (p_subject_type = 'seller' and seller_id = p_subject_id)
    );

  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  insert into public.portal_credentials (
    subject_type, store_id, seller_id, token_hash, token_prefix, created_by
  ) values (
    p_subject_type,
    case when p_subject_type = 'store' then p_subject_id else null end,
    case when p_subject_type = 'seller' then p_subject_id else null end,
    v_hash,
    left(v_token, 6),
    auth.uid()
  );
  return v_token;
end;
$$;

create or replace function public.revoke_portal_credential(p_credential_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_app_role() not in ('admin', 'gestor') then
    raise exception 'Apenas gestor ou administrador revoga links.';
  end if;
  update public.portal_credentials
  set revoked_at = now()
  where id = p_credential_id and revoked_at is null;
end;
$$;

create or replace function public.mark_message_viewed(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_app_role() is null then
    raise exception 'Sem permissão.';
  end if;
  update public.order_messages
  set status = 'visualizado', viewed_at = now(), viewed_by = auth.uid()
  where id = p_message_id and status = 'novo';
end;
$$;

create or replace function public.reply_order_message(p_message_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_role text := public.current_app_role();
begin
  if v_role not in ('admin', 'gestor', 'montador') then
    raise exception 'Sem permissão para responder recados.';
  end if;
  v_body := public.sanitize_portal_text(p_body);
  if v_body is null or char_length(v_body) > 800 then
    raise exception 'Escreva a resposta com até 800 caracteres.';
  end if;
  update public.order_messages
  set
    reply_body = v_body,
    replied_at = now(),
    replied_by = auth.uid(),
    status = 'respondido',
    viewed_at = coalesce(viewed_at, now()),
    viewed_by = coalesce(viewed_by, auth.uid())
  where id = p_message_id;
  if not found then
    raise exception 'Recado não encontrado.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.stores enable row level security;
alter table public.seller_stores enable row level security;
alter table public.portal_credentials enable row level security;
alter table public.order_messages enable row level security;
alter table public.portal_rate_buckets enable row level security;

drop policy if exists stores_select on public.stores;
create policy stores_select on public.stores
  for select to authenticated using (public.current_app_role() is not null);
drop policy if exists stores_write on public.stores;
create policy stores_write on public.stores
  for all to authenticated
  using (public.current_app_role() in ('admin', 'gestor', 'montador'))
  with check (public.current_app_role() in ('admin', 'gestor', 'montador'));

drop policy if exists seller_stores_select on public.seller_stores;
create policy seller_stores_select on public.seller_stores
  for select to authenticated using (public.current_app_role() is not null);
drop policy if exists seller_stores_write on public.seller_stores;
create policy seller_stores_write on public.seller_stores
  for all to authenticated
  using (public.current_app_role() in ('admin', 'gestor', 'montador'))
  with check (public.current_app_role() in ('admin', 'gestor', 'montador'));

drop policy if exists portal_credentials_select on public.portal_credentials;
create policy portal_credentials_select on public.portal_credentials
  for select to authenticated
  using (public.current_app_role() in ('admin', 'gestor'));

drop policy if exists order_messages_select on public.order_messages;
create policy order_messages_select on public.order_messages
  for select to authenticated using (public.current_app_role() is not null);

revoke all on function public.portal_credential(text, text) from public, anon, authenticated;
revoke all on function public.portal_rate_hit(text, integer, interval) from public, anon, authenticated;
revoke all on function public.issue_portal_credential(text, uuid) from public, anon;
revoke all on function public.revoke_portal_credential(uuid) from public, anon;
revoke all on function public.mark_message_viewed(uuid) from public, anon;
revoke all on function public.reply_order_message(uuid, text) from public, anon;

grant execute on function public.portal_orders(text, text, text, uuid, text, date, date, boolean, boolean) to anon, authenticated;
grant execute on function public.portal_order_detail(text, text, uuid) to anon, authenticated;
grant execute on function public.portal_send_message(text, text, uuid, text) to anon, authenticated;
grant execute on function public.portal_sellers(text, text) to anon, authenticated;
grant execute on function public.portal_identity(text, text) to anon, authenticated;
grant execute on function public.issue_portal_credential(text, uuid) to authenticated;
grant execute on function public.revoke_portal_credential(uuid) to authenticated;
grant execute on function public.mark_message_viewed(uuid) to authenticated;
grant execute on function public.reply_order_message(uuid, text) to authenticated;
grant execute on function public.create_service_order(text, uuid, uuid, timestamptz, timestamptz, text, text, text, text, text, jsonb, uuid) to authenticated;
grant execute on function public.update_service_order(uuid, text, uuid, uuid, timestamptz, timestamptz, text, text, text, text, jsonb, uuid) to authenticated;
