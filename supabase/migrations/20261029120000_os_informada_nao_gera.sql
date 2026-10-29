-- Serviço que já chega com número de OS usa esse número.
-- A sequência OS-ANO-SEQ só é consumida quando a OS nasce só com o nome.

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
  v_number text;
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
  if v_external is not null then
    if exists (
      select 1 from public.service_orders
      where number = v_external or external_order_id = v_external
    ) then
      raise exception 'Já existe uma OS com o número %.', v_external;
    end if;
    v_number := v_external;
    v_external := null;
  else
    v_number := public.next_os_number();
  end if;
  perform public.assert_order_parties(p_store_id, p_seller_id, null, null);

  insert into public.service_orders (
    number, client_name, seller_id, store_id, laboratory_id, entered_at, due_at, notes,
    service_description, external_order_id, priority, status, lens_spec, created_by, updated_by
  ) values (
    v_number,
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
