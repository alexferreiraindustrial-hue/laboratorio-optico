-- Funções de montagem, qualidade, estoque, leitura enriquecida, RLS e storage.

create or replace function public.advance_assembly_step(
  p_order_id uuid,
  p_step_key text,
  p_action text,
  p_notes text,
  p_measurements jsonb,
  p_reason text
)
returns public.assembly_steps
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_order public.service_orders;
  v_step public.assembly_steps;
  v_index integer;
  v_prev text;
begin
  if v_role not in ('admin', 'gestor', 'montador') then
    raise exception 'Sem permissão para registrar a etapa.';
  end if;

  select * into v_order from public.service_orders where id = p_order_id for update;
  if not found then
    raise exception 'OS não encontrada.';
  end if;
  if v_order.status not in ('em_montagem', 'em_correcao', 'em_conferencia') then
    raise exception 'A montagem só avança com a OS em execução, correção ou conferência.';
  end if;

  perform public.ensure_assembly_steps(p_order_id);
  select * into v_step
  from public.assembly_steps
  where order_id = p_order_id and step_key = p_step_key
  for update;

  v_index := array_position(array[
    'conferencia_inicial',
    'lensometria',
    'blocagem',
    'facetadora',
    'conferencia_qualidade'
  ], p_step_key);

  if v_index is null then
    raise exception 'Etapa desconhecida.';
  end if;

  if v_index > 1 then
    v_prev := (array[
      'conferencia_inicial',
      'lensometria',
      'blocagem',
      'facetadora',
      'conferencia_qualidade'
    ])[v_index - 1];
    if p_action in ('iniciar', 'concluir') and not exists (
      select 1 from public.assembly_steps
      where order_id = p_order_id and step_key = v_prev and status = 'concluida'
    ) then
      raise exception 'Conclua a etapa anterior antes de continuar.';
    end if;
  end if;

  if p_action = 'iniciar' then
    if v_step.status in ('concluida', 'em_andamento') then
      raise exception 'Esta etapa já foi iniciada ou concluída.';
    end if;
    update public.assembly_steps
    set status = 'em_andamento',
        started_at = coalesce(started_at, now()),
        assignee_id = auth.uid(),
        notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes),
        measurements = coalesce(p_measurements, measurements)
    where id = v_step.id
    returning * into v_step;
  elsif p_action = 'concluir' then
    if v_step.status = 'concluida' then
      raise exception 'Esta etapa já está concluída.';
    end if;
    update public.assembly_steps
    set status = 'concluida',
        started_at = coalesce(started_at, now()),
        completed_at = now(),
        assignee_id = coalesce(assignee_id, auth.uid()),
        notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes),
        measurements = coalesce(p_measurements, measurements)
    where id = v_step.id
    returning * into v_step;

    if p_step_key = 'facetadora' and v_order.status = 'em_montagem' then
      perform public.change_order_status(p_order_id, 'em_conferencia', 'Facetadora concluída');
    end if;
  elsif p_action = 'reprovar' then
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'Informe o motivo da reprovação.';
    end if;
    update public.assembly_steps
    set status = 'reprovada',
        assignee_id = coalesce(assignee_id, auth.uid()),
        notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes),
        measurements = coalesce(p_measurements, measurements)
    where id = v_step.id
    returning * into v_step;
    insert into public.assembly_step_history (step_id, order_id, action, status, notes, reason, user_id)
    values (v_step.id, p_order_id, 'reprovacao', 'reprovada', p_notes, trim(p_reason), auth.uid());
    if v_order.status <> 'em_correcao' then
      perform public.change_order_status(p_order_id, 'em_correcao', trim(p_reason));
    end if;
  elsif p_action = 'reabrir' then
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'Informe o motivo da correção.';
    end if;
    update public.assembly_steps
    set status = 'pendente',
        completed_at = null,
        notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes)
    where order_id = p_order_id
      and array_position(array[
        'conferencia_inicial', 'lensometria', 'blocagem', 'facetadora', 'conferencia_qualidade'
      ], step_key) >= v_index
      and (step_key = p_step_key or status <> 'pendente');
    insert into public.assembly_step_history (step_id, order_id, action, status, reason, user_id)
    values (v_step.id, p_order_id, 'reabertura', 'pendente', trim(p_reason), auth.uid());
    select * into v_step from public.assembly_steps where id = v_step.id;
    if v_order.status <> 'em_correcao' then
      perform public.change_order_status(p_order_id, 'em_correcao', trim(p_reason));
    end if;
  else
    raise exception 'Ação de etapa inválida.';
  end if;

  return v_step;
end;
$$;

create or replace function public.register_quality_occurrence(
  p_order_id uuid,
  p_category_id uuid,
  p_step_key text,
  p_description text,
  p_severity text,
  p_corrective_action text
)
returns public.quality_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_row public.quality_occurrences;
begin
  if v_role not in ('admin', 'gestor', 'montador') then
    raise exception 'Sem permissão para registrar ocorrência.';
  end if;
  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Descreva a ocorrência.';
  end if;
  if not exists (select 1 from public.quality_categories where id = p_category_id and active) then
    raise exception 'Categoria indisponível.';
  end if;

  insert into public.quality_occurrences (
    order_id, category_id, step_key, reported_by, description, severity, corrective_action
  ) values (
    p_order_id,
    p_category_id,
    nullif(p_step_key, ''),
    auth.uid(),
    trim(p_description),
    coalesce(p_severity, 'media'),
    nullif(trim(coalesce(p_corrective_action, '')), '')
  ) returning * into v_row;

  insert into public.quality_actions (occurrence_id, description, status, user_id)
  values (v_row.id, 'Ocorrência registrada', v_row.status, auth.uid());

  return v_row;
end;
$$;

create or replace function public.update_quality_occurrence(
  p_id uuid,
  p_status text,
  p_corrective_action text,
  p_closing_note text
)
returns public.quality_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_row public.quality_occurrences;
begin
  if v_role not in ('admin', 'gestor', 'montador') then
    raise exception 'Sem permissão para atualizar a ocorrência.';
  end if;
  if p_status not in ('aberta', 'em_tratamento', 'resolvida', 'dispensada') then
    raise exception 'Situação inválida.';
  end if;

  update public.quality_occurrences
  set status = p_status,
      corrective_action = nullif(trim(coalesce(p_corrective_action, '')), ''),
      closing_note = nullif(trim(coalesce(p_closing_note, '')), ''),
      closed_at = case
        when p_status in ('resolvida', 'dispensada') then coalesce(closed_at, now())
        else null
      end
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Ocorrência não encontrada.';
  end if;

  insert into public.quality_actions (occurrence_id, description, status, user_id)
  values (
    v_row.id,
    coalesce(nullif(trim(coalesce(p_closing_note, p_corrective_action, '')), ''), 'Situação atualizada'),
    v_row.status,
    auth.uid()
  );

  return v_row;
end;
$$;

create or replace function public.generate_public_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'LN-';
  i integer;
begin
  for i in 1..10 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.assign_public_code()
returns trigger
language plpgsql
as $$
declare
  candidate text;
  tries integer := 0;
begin
  if new.public_code is null or new.public_code = '' then
    loop
      tries := tries + 1;
      candidate := public.generate_public_code();
      exit when not exists (
        select 1 from public.lens_prescription_stock where public_code = candidate
      );
      if tries > 20 then
        raise exception 'Não foi possível gerar o código da etiqueta.';
      end if;
    end loop;
    new.public_code := candidate;
  end if;
  if new.public_code !~ '^LN-[A-Z2-9]{10}$' then
    raise exception 'Código de estoque inválido.';
  end if;
  return new;
end;
$$;

create trigger lens_public_code
  before insert on public.lens_prescription_stock
  for each row execute function public.assign_public_code();

create or replace function public.apply_stock_movement(
  p_stock_id uuid,
  p_type text,
  p_quantity integer,
  p_reason text,
  p_order_id uuid,
  p_lot text,
  p_allow_negative boolean,
  p_idempotency_key text
)
returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_row public.lens_prescription_stock;
  v_delta integer;
  v_next integer;
  v_movement public.stock_movements;
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if v_role is null then
    raise exception 'Sessão inválida.';
  end if;
  if p_type = 'consumo' then
    if v_role not in ('admin', 'gestor', 'montador', 'estoquista') then
      raise exception 'Sem permissão para consumir lentes.';
    end if;
  elsif v_role not in ('admin', 'gestor', 'estoquista') then
    raise exception 'Sem permissão para movimentar o estoque.';
  end if;
  if coalesce(p_allow_negative, false) and v_role not in ('admin', 'gestor') then
    raise exception 'A saída acima do saldo exige gestor ou administrador.';
  end if;
  if p_quantity is null or (p_type <> 'correcao' and p_quantity <= 0) or (p_type = 'correcao' and p_quantity = 0) then
    raise exception 'Informe uma quantidade válida.';
  end if;
  if p_type <> 'correcao' and p_type <> 'ajuste' and p_quantity <= 0 then
    raise exception 'Informe uma quantidade válida.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 3 then
    raise exception 'Informe o motivo da movimentação.';
  end if;
  if v_key is not null and exists (
    select 1 from public.stock_movements where idempotency_key = v_key
  ) then
    raise exception 'Esta movimentação já foi registrada.';
  end if;

  if p_type = 'consumo' then
    if p_order_id is null then
      raise exception 'O consumo de lente precisa de uma OS.';
    end if;
    if exists (
      select 1 from public.stock_movements
      where order_id = p_order_id and stock_id = p_stock_id and movement_type = 'consumo'
    ) then
      raise exception 'Esta OS já consumiu este item. Use outra operação se precisar de um lançamento diferente.';
    end if;
    v_key := coalesce(v_key, 'consumo:' || p_order_id::text || ':' || p_stock_id::text);
  end if;

  select * into v_row from public.lens_prescription_stock where id = p_stock_id for update;
  if not found then
    raise exception 'Item de estoque não encontrado.';
  end if;

  if p_type in ('entrada', 'devolucao') then
    v_delta := p_quantity;
  elsif p_type in ('saida', 'consumo') then
    v_delta := -p_quantity;
  elsif p_type = 'ajuste' then
    if p_quantity < 0 then
      raise exception 'O inventário não pode ser negativo.';
    end if;
    v_delta := p_quantity - v_row.current_qty;
  elsif p_type = 'correcao' then
    v_delta := p_quantity;
  else
    raise exception 'Tipo de movimentação inválido.';
  end if;

  if v_delta = 0 then
    raise exception 'A movimentação não altera o saldo.';
  end if;

  v_next := v_row.current_qty + v_delta;
  if v_next < 0 and not coalesce(p_allow_negative, false) then
    raise exception 'Saída maior que o saldo disponível (%).', v_row.current_qty;
  end if;

  perform set_config('app.stock_write', 'on', true);
  update public.lens_prescription_stock
  set current_qty = v_next,
      lot_code = coalesce(nullif(trim(coalesce(p_lot, '')), ''), lot_code)
  where id = p_stock_id;

  insert into public.stock_movements (
    stock_id, movement_type, quantity, signed_delta, balance_after,
    reason, order_id, lot_code, user_id, exceptional, needs_review, idempotency_key
  ) values (
    p_stock_id,
    p_type,
    abs(v_delta),
    v_delta,
    v_next,
    trim(p_reason),
    p_order_id,
    nullif(trim(coalesce(p_lot, '')), ''),
    auth.uid(),
    coalesce(p_allow_negative, false) and v_next < 0,
    p_type = 'correcao' or (coalesce(p_allow_negative, false) and v_next < 0),
    v_key
  ) returning * into v_movement;

  return v_movement;
end;
$$;

create or replace function public.set_stock_thresholds(
  p_ids uuid[],
  p_min_qty integer,
  p_ideal_qty integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_count integer;
begin
  if v_role not in ('admin', 'gestor', 'estoquista') then
    raise exception 'Sem permissão para ajustar o estoque mínimo.';
  end if;
  if p_min_qty < 0 or p_ideal_qty < 0 then
    raise exception 'As quantidades de reposição não podem ser negativas.';
  end if;
  update public.lens_prescription_stock
  set min_qty = p_min_qty,
      ideal_qty = p_ideal_qty
  where id = any(p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.upsert_setting(
  p_key text,
  p_value jsonb
)
returns public.system_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_row public.system_settings;
begin
  if v_role not in ('admin', 'gestor') then
    raise exception 'Sem permissão para alterar as configurações.';
  end if;
  insert into public.system_settings (key, value, updated_by)
  values (p_key, p_value, auth.uid())
  on conflict (key) do update
  set value = excluded.value,
      updated_by = excluded.updated_by
  returning * into v_row;
  return v_row;
end;
$$;

create or replace view public.orders_enriched
with (security_invoker = true) as
select
  o.*,
  l.name as laboratory_name,
  l.color as laboratory_color,
  l.code as laboratory_code,
  s.name as seller_name,
  public.order_urgency(o.due_at, o.status, o.priority) as urgency
from public.service_orders o
join public.laboratories l on l.id = o.laboratory_id
left join public.sellers s on s.id = o.seller_id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.laboratories enable row level security;
alter table public.sellers enable row level security;
alter table public.system_settings enable row level security;
alter table public.production_goals enable row level security;
alter table public.quality_categories enable row level security;
alter table public.service_orders enable row level security;
alter table public.order_status_history enable row level security;
alter table public.assembly_steps enable row level security;
alter table public.assembly_step_history enable row level security;
alter table public.quality_occurrences enable row level security;
alter table public.quality_actions enable row level security;
alter table public.lens_prescription_stock enable row level security;
alter table public.stock_movements enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_app_role() is not null);

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.current_app_role() = 'admin')
  with check (id = auth.uid() or public.current_app_role() = 'admin');

create policy laboratories_select on public.laboratories
  for select to authenticated using (public.current_app_role() is not null);
create policy laboratories_write on public.laboratories
  for all to authenticated
  using (public.current_app_role() in ('admin', 'gestor'))
  with check (public.current_app_role() in ('admin', 'gestor'));

create policy sellers_select on public.sellers
  for select to authenticated using (public.current_app_role() is not null);
create policy sellers_write on public.sellers
  for all to authenticated
  using (public.current_app_role() in ('admin', 'gestor'))
  with check (public.current_app_role() in ('admin', 'gestor'));

create policy settings_select on public.system_settings
  for select to authenticated using (public.current_app_role() is not null);
create policy settings_write on public.system_settings
  for all to authenticated
  using (public.current_app_role() in ('admin', 'gestor'))
  with check (public.current_app_role() in ('admin', 'gestor'));

create policy goals_select on public.production_goals
  for select to authenticated using (public.current_app_role() is not null);
create policy goals_write on public.production_goals
  for all to authenticated
  using (public.current_app_role() in ('admin', 'gestor'))
  with check (public.current_app_role() in ('admin', 'gestor'));

create policy categories_select on public.quality_categories
  for select to authenticated using (public.current_app_role() is not null);
create policy categories_write on public.quality_categories
  for all to authenticated
  using (public.current_app_role() in ('admin', 'gestor'))
  with check (public.current_app_role() in ('admin', 'gestor'));

create policy orders_select on public.service_orders
  for select to authenticated using (public.current_app_role() is not null);
create policy orders_insert on public.service_orders
  for insert to authenticated
  with check (public.current_app_role() in ('admin', 'gestor', 'montador'));
create policy orders_update on public.service_orders
  for update to authenticated
  using (public.current_app_role() in ('admin', 'gestor', 'montador'))
  with check (public.current_app_role() in ('admin', 'gestor', 'montador'));

create policy history_select on public.order_status_history
  for select to authenticated using (public.current_app_role() is not null);

create policy steps_select on public.assembly_steps
  for select to authenticated using (public.current_app_role() is not null);
create policy steps_write on public.assembly_steps
  for all to authenticated
  using (public.current_app_role() in ('admin', 'gestor', 'montador'))
  with check (public.current_app_role() in ('admin', 'gestor', 'montador'));

create policy step_history_select on public.assembly_step_history
  for select to authenticated using (public.current_app_role() is not null);

create policy occurrences_select on public.quality_occurrences
  for select to authenticated using (public.current_app_role() is not null);
create policy occurrences_write on public.quality_occurrences
  for all to authenticated
  using (public.current_app_role() in ('admin', 'gestor', 'montador'))
  with check (public.current_app_role() in ('admin', 'gestor', 'montador'));

create policy actions_select on public.quality_actions
  for select to authenticated using (public.current_app_role() is not null);

create policy stock_select on public.lens_prescription_stock
  for select to authenticated using (public.current_app_role() is not null);
create policy stock_insert on public.lens_prescription_stock
  for insert to authenticated
  with check (public.current_app_role() in ('admin', 'gestor', 'estoquista'));
create policy stock_update on public.lens_prescription_stock
  for update to authenticated
  using (public.current_app_role() in ('admin', 'gestor', 'estoquista'))
  with check (public.current_app_role() in ('admin', 'gestor', 'estoquista'));

create policy movements_select on public.stock_movements
  for select to authenticated using (public.current_app_role() is not null);

create policy attachments_select on public.attachments
  for select to authenticated using (public.current_app_role() is not null and deleted_at is null);
create policy attachments_insert on public.attachments
  for insert to authenticated
  with check (public.current_app_role() in ('admin', 'gestor', 'montador', 'estoquista'));
create policy attachments_update on public.attachments
  for update to authenticated
  using (
    public.current_app_role() in ('admin', 'gestor')
    or uploaded_by = auth.uid()
  )
  with check (
    public.current_app_role() in ('admin', 'gestor')
    or uploaded_by = auth.uid()
  );

create policy audit_select on public.audit_logs
  for select to authenticated
  using (public.current_app_role() in ('admin', 'gestor'));

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from public;
grant execute on function public.has_any_user() to anon, authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.order_urgency(timestamptz, text, text) to authenticated;
grant execute on function public.create_service_order(text, uuid, uuid, timestamptz, timestamptz, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.update_service_order(uuid, text, uuid, uuid, timestamptz, timestamptz, text, text, text, text, jsonb) to authenticated;
grant execute on function public.change_order_status(uuid, text, text) to authenticated;
grant execute on function public.advance_assembly_step(uuid, text, text, text, jsonb, text) to authenticated;
grant execute on function public.register_quality_occurrence(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.update_quality_occurrence(uuid, text, text, text) to authenticated;
grant execute on function public.apply_stock_movement(uuid, text, integer, text, uuid, text, boolean, text) to authenticated;
grant execute on function public.set_stock_thresholds(uuid[], integer, integer) to authenticated;
grant execute on function public.upsert_setting(text, jsonb) to authenticated;
grant execute on function public.ensure_assembly_steps(uuid) to authenticated;

-- Categorias iniciais do controle de qualidade. São parâmetros, não registros operacionais.
insert into public.quality_categories (name, sort_order)
select name, ordinality::int
from unnest(array[
  'Lente riscada',
  'Lente com dano externo',
  'Antirreflexo craquelado',
  'Lente sem tratamento devido',
  'Grau divergente do pedido',
  'Lente incorreta',
  'Erro de blocagem',
  'Erro de facetamento ou corte',
  'Problema identificado na conferência final',
  'Outros'
]) with ordinality as category(name, ordinality)
on conflict (name) do nothing;

insert into public.system_settings (key, value)
values
  ('operations', jsonb_build_object('deadline_alert_hours', 24, 'org_name', 'Laboratório Óptico')),
  ('schedule', jsonb_build_object('weekdays', jsonb_build_array(1, 2, 3, 4, 5), 'start', '08:00', 'end', '18:00')),
  ('stock_grid', jsonb_build_object(
    'sphere_min_cents', -400,
    'sphere_max_cents', 400,
    'cylinder_min_cents', -300,
    'cylinder_max_cents', 0,
    'step_cents', 25
  ))
on conflict (key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lab-files',
  'lab-files',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy lab_files_read on storage.objects
  for select to authenticated
  using (bucket_id = 'lab-files' and public.current_app_role() is not null);

create policy lab_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lab-files'
    and public.current_app_role() in ('admin', 'gestor', 'montador', 'estoquista')
  );

create policy lab_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lab-files'
    and public.current_app_role() in ('admin', 'gestor', 'montador', 'estoquista')
  );
