-- Laboratório Óptico
-- Migração inicial: tabelas, integridade, RLS, funções transacionais e storage.
-- Execute no SQL Editor do Supabase, nesta ordem, uma única vez.
-- Não contém ordens, estoque ou usuários fictícios.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cadastros
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'consulta' check (role in ('admin', 'gestor', 'montador', 'estoquista', 'consulta')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and active = true
$$;

create or replace function public.has_any_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles);
$$;

create table public.laboratories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  color text not null default '#0e6b62',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint laboratories_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_goals (
  id uuid primary key default gen_random_uuid(),
  laboratory_id uuid references public.laboratories (id) on delete cascade,
  scope text not null check (scope in ('daily', 'weekly', 'monthly')),
  target integer not null check (target >= 0),
  valid_from date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (laboratory_id, scope, valid_from)
);

create table public.quality_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ordens
-- ---------------------------------------------------------------------------

create sequence public.os_number_seq;

create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_name text not null,
  seller_id uuid references public.sellers (id),
  laboratory_id uuid not null references public.laboratories (id),
  entered_at timestamptz not null,
  due_at timestamptz,
  notes text,
  service_description text not null,
  external_order_id text,
  status text not null default 'aguardando_lentes' check (
    status in (
      'aguardando_lentes',
      'aguardando_montagem',
      'em_montagem',
      'em_correcao',
      'em_conferencia',
      'pronto',
      'entregue',
      'cancelado'
    )
  ),
  priority text not null default 'normal' check (priority in ('normal', 'critica')),
  lens_spec jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_orders_due_after_entry check (due_at is null or due_at >= entered_at)
);

create unique index service_orders_external_uidx
  on public.service_orders (external_order_id)
  where external_order_id is not null;

create index service_orders_status_idx on public.service_orders (status);
create index service_orders_lab_idx on public.service_orders (laboratory_id);
create index service_orders_due_idx on public.service_orders (due_at);
create index service_orders_completed_idx on public.service_orders (completed_at);
create index service_orders_entered_idx on public.service_orders (entered_at);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  user_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.assembly_steps (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders (id) on delete cascade,
  step_key text not null check (
    step_key in (
      'conferencia_inicial',
      'lensometria',
      'blocagem',
      'facetadora',
      'conferencia_qualidade'
    )
  ),
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida', 'reprovada')),
  assignee_id uuid references public.profiles (id),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  measurements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, step_key)
);

create table public.assembly_step_history (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.assembly_steps (id) on delete cascade,
  order_id uuid not null references public.service_orders (id) on delete cascade,
  action text not null,
  status text,
  notes text,
  measurements jsonb,
  reason text,
  user_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assembly_step_history_order_idx on public.assembly_step_history (order_id, created_at);

create table public.quality_occurrences (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders (id) on delete cascade,
  category_id uuid not null references public.quality_categories (id),
  step_key text,
  occurred_at timestamptz not null default now(),
  reported_by uuid references public.profiles (id),
  description text not null,
  severity text not null default 'media' check (severity in ('baixa', 'media', 'alta', 'critica')),
  status text not null default 'aberta' check (status in ('aberta', 'em_tratamento', 'resolvida', 'dispensada')),
  corrective_action text,
  closing_note text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quality_occurrences_order_idx on public.quality_occurrences (order_id);
create index quality_occurrences_occurred_idx on public.quality_occurrences (occurred_at);

create table public.quality_actions (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.quality_occurrences (id) on delete cascade,
  description text not null,
  status text not null,
  user_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Estoque
-- Graus em centésimos de dioptria (inteiros). -1,25 = -125.
-- ---------------------------------------------------------------------------

create table public.lens_prescription_stock (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  manufacturer text,
  brand text,
  material text,
  refractive_index numeric(4, 2),
  treatment text,
  color text,
  diameter_mm numeric(5, 1),
  sphere_cents smallint not null,
  cylinder_cents smallint not null,
  addition_cents smallint,
  lens_type text,
  lot_code text,
  location text,
  is_special boolean not null default false,
  min_qty integer not null default 0 check (min_qty >= 0),
  ideal_qty integer not null default 0 check (ideal_qty >= 0),
  current_qty integer not null default 0,
  unit_cost_cents integer check (unit_cost_cents is null or unit_cost_cents >= 0),
  active boolean not null default true,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index lens_stock_combo_uidx on public.lens_prescription_stock (
  coalesce(manufacturer, ''),
  coalesce(brand, ''),
  coalesce(material, ''),
  coalesce(refractive_index, -1),
  coalesce(treatment, ''),
  coalesce(color, ''),
  coalesce(diameter_mm, -1),
  sphere_cents,
  cylinder_cents,
  coalesce(addition_cents, -32768),
  coalesce(lens_type, ''),
  coalesce(lot_code, ''),
  coalesce(location, '')
);

create index lens_stock_power_idx on public.lens_prescription_stock (sphere_cents, cylinder_cents);
create index lens_stock_special_idx on public.lens_prescription_stock (is_special) where is_special;

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null references public.lens_prescription_stock (id),
  movement_type text not null check (
    movement_type in ('entrada', 'saida', 'ajuste', 'devolucao', 'correcao', 'consumo')
  ),
  quantity integer not null check (quantity > 0),
  signed_delta integer not null,
  balance_after integer not null,
  reason text not null,
  order_id uuid references public.service_orders (id),
  lot_code text,
  user_id uuid references public.profiles (id),
  exceptional boolean not null default false,
  needs_review boolean not null default false,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index stock_consumo_once
  on public.stock_movements (order_id, stock_id)
  where movement_type = 'consumo';

create index stock_movements_stock_idx on public.stock_movements (stock_id, created_at desc);
create index stock_movements_order_idx on public.stock_movements (order_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('order', 'step', 'occurrence')),
  entity_id uuid not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  uploaded_by uuid references public.profiles (id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index attachments_entity_idx on public.attachments (entity_type, entity_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers de manutenção
-- ---------------------------------------------------------------------------

create or replace function public.audit_change()
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
    tg_table_name,
    coalesce(new.id, old.id),
    case
      when tg_op = 'DELETE' then jsonb_build_object('old', to_jsonb(old))
      when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      else jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
    end
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and public.current_app_role() is distinct from 'admin' then
    raise exception 'Apenas um administrador pode alterar o perfil de acesso.';
  end if;
  if old.role = 'admin' and old.active and (new.role is distinct from 'admin' or new.active = false) then
    if (
      select count(*)
      from public.profiles
      where role = 'admin' and active and id <> old.id
    ) = 0 then
      raise exception 'Mantenha ao menos um administrador ativo.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_order_controlled_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.status not in ('aguardando_lentes', 'aguardando_montagem') then
    raise exception 'Uma OS nova começa aguardando lentes ou aguardando montagem.';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and current_setting('app.status_write', true) is distinct from 'on' then
    raise exception 'Altere o status pela movimentação operacional.';
  end if;
  if tg_op = 'UPDATE' and new.completed_at is distinct from old.completed_at
     and current_setting('app.status_write', true) is distinct from 'on' then
    raise exception 'A conclusão é registrada quando a ordem fica pronta.';
  end if;
  if tg_op = 'UPDATE' and new.number is distinct from old.number then
    raise exception 'O número da OS não pode ser alterado.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_stock_qty()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.current_qty is distinct from old.current_qty
     and current_setting('app.stock_write', true) is distinct from 'on' then
    raise exception 'O saldo só pode mudar por uma movimentação de estoque.';
  end if;
  return new;
end;
$$;

create or replace function public.log_assembly_step()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.status is distinct from old.status
    or new.notes is distinct from old.notes
    or new.measurements is distinct from old.measurements
  ) then
    insert into public.assembly_step_history (
      step_id, order_id, action, status, notes, measurements, user_id
    ) values (
      new.id,
      new.order_id,
      'alteracao',
      new.status,
      new.notes,
      new.measurements,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned text;
begin
  if exists (select 1 from public.profiles) then
    assigned := 'consulta';
  else
    assigned := 'admin';
  end if;
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    assigned
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_role();
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.audit_change();

create trigger laboratories_touch before update on public.laboratories
  for each row execute function public.touch_updated_at();
create trigger sellers_touch before update on public.sellers
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.system_settings
  for each row execute function public.touch_updated_at();
create trigger goals_touch before update on public.production_goals
  for each row execute function public.touch_updated_at();
create trigger categories_touch before update on public.quality_categories
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.service_orders
  for each row execute function public.touch_updated_at();
create trigger orders_guard before insert or update on public.service_orders
  for each row execute function public.guard_order_controlled_fields();
create trigger orders_audit after insert or update or delete on public.service_orders
  for each row execute function public.audit_change();
create trigger steps_touch before update on public.assembly_steps
  for each row execute function public.touch_updated_at();
create trigger steps_history after update on public.assembly_steps
  for each row execute function public.log_assembly_step();
create trigger occurrences_touch before update on public.quality_occurrences
  for each row execute function public.touch_updated_at();
create trigger occurrences_audit after insert or update on public.quality_occurrences
  for each row execute function public.audit_change();
create trigger stock_touch before update on public.lens_prescription_stock
  for each row execute function public.touch_updated_at();
create trigger stock_guard before update on public.lens_prescription_stock
  for each row execute function public.guard_stock_qty();
create trigger stock_audit after insert or update on public.lens_prescription_stock
  for each row execute function public.audit_change();
create trigger movements_audit after insert on public.stock_movements
  for each row execute function public.audit_change();

-- ---------------------------------------------------------------------------
-- Funções operacionais
-- ---------------------------------------------------------------------------

create or replace function public.next_os_number()
returns text
language plpgsql
as $$
declare
  year_text text;
begin
  year_text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  return 'OS-' || year_text || '-' || lpad(nextval('public.os_number_seq')::text, 6, '0');
end;
$$;

create or replace function public.order_urgency(
  p_due_at timestamptz,
  p_status text,
  p_priority text
)
returns text
language sql
stable
as $$
  select case
    when p_status in ('cancelado', 'entregue') or p_due_at is null then 'cinza'
    when p_priority = 'critica' or p_due_at < now() then 'vermelho'
    when p_due_at <= now() + make_interval(
      hours => coalesce(
        (
          select (value ->> 'deadline_alert_hours')::int
          from public.system_settings
          where key = 'operations'
        ),
        24
      )
    ) then 'amarelo'
    else 'verde'
  end
$$;

create or replace function public.ensure_assembly_steps(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.assembly_steps (order_id, step_key)
  select p_order_id, step
  from unnest(array[
    'conferencia_inicial',
    'lensometria',
    'blocagem',
    'facetadora',
    'conferencia_qualidade'
  ]) as step
  on conflict (order_id, step_key) do nothing;
end;
$$;

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
  p_lens_spec jsonb
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

  insert into public.service_orders (
    number, client_name, seller_id, laboratory_id, entered_at, due_at, notes,
    service_description, external_order_id, priority, status, lens_spec, created_by, updated_by
  ) values (
    public.next_os_number(),
    trim(p_client_name),
    p_seller_id,
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
  p_lens_spec jsonb
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
    raise exception 'Sem permissão para editar a OS.';
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

  update public.service_orders
  set
    client_name = trim(p_client_name),
    seller_id = p_seller_id,
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

  if not found then
    raise exception 'OS não encontrada.';
  end if;
  return v_order;
end;
$$;

create or replace function public.change_order_status(
  p_order_id uuid,
  p_to text,
  p_note text
)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_order public.service_orders;
  v_from text;
  v_open integer;
  v_steps integer;
begin
  if v_role not in ('admin', 'gestor', 'montador') then
    raise exception 'Sem permissão para movimentar a OS.';
  end if;
  if p_to = 'cancelado' and v_role not in ('admin', 'gestor') then
    raise exception 'Apenas gestor ou administrador cancela uma OS.';
  end if;
  if p_to = 'entregue' and v_role not in ('admin', 'gestor') then
    raise exception 'Apenas gestor ou administrador marca a entrega.';
  end if;
  if v_role = 'montador' and p_to = 'aguardando_lentes' then
    raise exception 'O operador de montagem não libera a falta de lentes.';
  end if;

  select * into v_order from public.service_orders where id = p_order_id for update;
  if not found then
    raise exception 'OS não encontrada.';
  end if;
  v_from := v_order.status;
  if v_from = p_to then
    raise exception 'A ordem já está neste status.';
  end if;

  if not (
    (v_from = 'aguardando_lentes' and p_to in ('aguardando_montagem', 'cancelado'))
    or (v_from = 'aguardando_montagem' and p_to in ('em_montagem', 'aguardando_lentes', 'cancelado'))
    or (v_from = 'em_montagem' and p_to in ('em_correcao', 'em_conferencia', 'aguardando_montagem', 'cancelado'))
    or (v_from = 'em_correcao' and p_to in ('em_montagem', 'cancelado'))
    or (v_from = 'em_conferencia' and p_to in ('pronto', 'em_correcao', 'cancelado'))
    or (v_from = 'pronto' and p_to in ('entregue', 'em_correcao'))
  ) then
    raise exception 'Esta mudança de status não faz parte do fluxo operacional.';
  end if;

  if p_to = 'pronto' then
    select count(*) into v_steps
    from public.assembly_steps
    where order_id = p_order_id and status = 'concluida';
    if v_steps < 5 then
      raise exception 'Conclua as cinco etapas antes de marcar a OS como pronta.';
    end if;
    select count(*) into v_open
    from public.quality_occurrences
    where order_id = p_order_id and status in ('aberta', 'em_tratamento');
    if v_open > 0 then
      raise exception 'Resolva as ocorrências de qualidade antes de marcar a OS como pronta.';
    end if;
  end if;

  if p_to = 'em_montagem' then
    perform public.ensure_assembly_steps(p_order_id);
  end if;

  perform set_config('app.status_write', 'on', true);
  update public.service_orders
  set
    status = p_to,
    completed_at = case
      when p_to = 'pronto' then coalesce(completed_at, now())
      when p_to = 'em_correcao' then null
      else completed_at
    end,
    delivered_at = case
      when p_to = 'entregue' then coalesce(delivered_at, now())
      else delivered_at
    end,
    updated_by = auth.uid()
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
  values (
    p_order_id,
    v_from,
    p_to,
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid()
  );

  return v_order;
end;
$$;
