-- Apenas regras e novas tabelas. Sem backfill, reclassificação ou movimentação de OS existentes.
begin;
set local lock_timeout='5s';
create or replace function public.guard_order_controlled_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.status not in ('aguardando_lentes', 'aguardando_montagem') and not(new.status='pronto' and current_setting('app.ready_import',true) is not distinct from 'on') then
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
  if auth.uid() is null or coalesce(v_role,'') not in ('admin', 'gestor', 'montador') then
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
  if coalesce(p_status, 'aguardando_lentes') not in ('aguardando_lentes', 'aguardando_montagem') and not(p_status='pronto' and current_setting('app.ready_import',true) is not distinct from 'on') then
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
  if auth.uid() is null or coalesce(v_role,'') not in ('admin', 'gestor', 'montador') then
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
    or (v_from = 'aguardando_montagem' and p_to in ('pronto', 'em_montagem', 'aguardando_lentes', 'cancelado'))
    or (v_from = 'em_montagem' and p_to in ('pronto', 'em_correcao', 'em_conferencia', 'aguardando_montagem', 'cancelado'))
    or (v_from = 'em_correcao' and p_to in ('em_montagem', 'cancelado'))
    or (v_from = 'em_conferencia' and p_to in ('pronto', 'em_correcao', 'cancelado'))
    or (v_from = 'pronto' and p_to in ('entregue', 'em_correcao', 'em_conferencia'))
  ) then
    raise exception 'Esta mudança de status não faz parte do fluxo operacional.';
  end if;

  if p_to='em_correcao' and current_setting('app.correction_write',true) is distinct from 'on' and not exists(select 1 from public.quality_occurrences where order_id=p_order_id and status in ('aberta','em_tratamento')) then raise exception 'Use Enviar para correção e informe o problema identificado.';end if;
  if p_to='em_correcao' and length(trim(coalesce(p_note,'')))<3 then raise exception 'Informe o problema antes de enviar para correção.'; end if;
  if p_to = 'pronto' then
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

  perform set_config('app.followup_write','on',true);
  perform set_config('app.status_write', 'on', true);
  update public.service_orders
  set
    status = p_to,
    medical_review_required=case when p_to='em_conferencia' then true else medical_review_required end,
    medical_review_approved_at=case when p_to='em_conferencia' then null else medical_review_approved_at end,
    medical_review_note=case when p_to='em_conferencia' then null else medical_review_note end,
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

  perform set_config('app.followup_write','off',true);
  perform set_config('app.status_write','off',true);
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
  if auth.uid() is null or coalesce(v_role,'') not in ('admin', 'gestor', 'montador') then
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
      perform set_config('app.correction_write','on',true);
      perform public.change_order_status(p_order_id, 'em_correcao', trim(p_reason));
      perform set_config('app.correction_write','off',true);
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
      perform set_config('app.correction_write','on',true);
      perform public.change_order_status(p_order_id, 'em_correcao', trim(p_reason));
      perform set_config('app.correction_write','off',true);
    end if;
  else
    raise exception 'Ação de etapa inválida.';
  end if;

  return v_step;
end;
$$;

create or replace function public.approve_medical_review(p_order_id uuid,p_note text,p_expected_updated_at timestamptz)
returns public.service_orders language plpgsql security definer set search_path=public as $$
declare o public.service_orders;
begin
 if auth.uid() is null or coalesce(public.current_app_role(),'') not in ('admin','gestor','montador') then raise exception 'Sem permissão.'; end if;
 if length(trim(coalesce(p_note,'')))<3 or length(p_note)>1000 then raise exception 'Informe quem conferiu e o resultado (3 a 1000 caracteres).'; end if;
 select * into o from public.service_orders where id=p_order_id for update;
 if not found then raise exception 'OS não encontrada.'; end if;
 if p_expected_updated_at is null or o.updated_at is distinct from p_expected_updated_at then raise exception 'OS alterada por outra pessoa. Atualize a tela.'; end if;
 if o.status<>'em_conferencia' or not coalesce(o.medical_review_required,false) or o.medical_review_approved_at is not null then raise exception 'Esta OS não está aguardando a conferência médica.'; end if;
if exists(select 1 from public.quality_occurrences where order_id=o.id and status in ('aberta','em_tratamento')) then raise exception 'Resolva as ocorrências antes da liberação médica.'; end if;
 perform set_config('app.followup_write','on',true);
 update public.service_orders set medical_review_approved_at=now(),medical_review_note=trim(p_note),updated_by=auth.uid() where id=o.id returning * into o;
 perform set_config('app.followup_write','off',true);
 insert into public.order_status_history(order_id,from_status,to_status,note,user_id) values(o.id,o.status,o.status,'Retorno médico registrado: '||trim(p_note),auth.uid());
 select * into o from public.change_order_status(o.id,'pronto','Liberado após retorno da conferência médica');
 return o;
end; $$;

create table if not exists public.order_stage_notes(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.service_orders(id),
 step_key text check(step_key is null or step_key in ('conferencia_inicial','lensometria','blocagem','facetadora','conferencia_qualidade')),
 description text not null check(length(trim(description)) between 3 and 2000),
 sent_to_correction boolean not null default false,created_at timestamptz not null default now(),created_by uuid not null references auth.users(id)
);
alter table public.order_stage_notes enable row level security;
drop policy if exists stage_notes_read on public.order_stage_notes;
create policy stage_notes_read on public.order_stage_notes for select to authenticated using(public.current_app_role() is not null);
revoke all on public.order_stage_notes from anon,authenticated;
grant select on public.order_stage_notes to authenticated;
create or replace function public.register_order_stage_note(p_order_id uuid,p_step_key text,p_description text,p_correction boolean default false)
returns public.order_stage_notes language plpgsql security definer set search_path=public as $$
declare o public.service_orders; n public.order_stage_notes;
begin
 if auth.uid() is null or coalesce(public.current_app_role(),'') not in ('admin','gestor','montador') then raise exception 'Sem permissão.';end if;
 if length(trim(coalesce(p_description,'')))<3 or length(p_description)>2000 then raise exception 'Descreva o registro em 3 a 2000 caracteres.';end if;
 select * into o from public.service_orders where id=p_order_id for update;
 if not found or o.status in ('entregue','cancelado') then raise exception 'Serviço inexistente ou encerrado.';end if;
 insert into public.order_stage_notes(order_id,step_key,description,sent_to_correction,created_by) values(o.id,nullif(p_step_key,''),trim(p_description),coalesce(p_correction,false),auth.uid()) returning * into n;
 insert into public.order_status_history(order_id,from_status,to_status,note,user_id) values(o.id,o.status,o.status,'Registro técnico ['||coalesce(nullif(p_step_key,''),'geral')||']: '||trim(p_description),auth.uid());
 if p_correction and o.status<>'em_correcao' then perform set_config('app.correction_write','on',true);perform public.change_order_status(o.id,'em_correcao',trim(p_description));perform set_config('app.correction_write','off',true);end if;
 return n;
end;$$;

create or replace function public.send_order_to_correction(p_order_id uuid,p_problem text) returns public.service_orders language plpgsql security definer set search_path=public as $$
declare o public.service_orders;
begin
 perform public.register_order_stage_note(p_order_id,null,p_problem,true);
 select * into o from public.service_orders where id=p_order_id;return o;
end;$$;
revoke all on function public.send_order_to_correction(uuid,text) from public,anon;
grant execute on function public.send_order_to_correction(uuid,text) to authenticated;

create or replace function public.create_ready_service_order(p_order jsonb,p_completed_at timestamptz)
returns public.service_orders language plpgsql security definer set search_path=public as $$
declare o public.service_orders;
begin
 if auth.uid() is null or coalesce(public.current_app_role(),'') not in ('admin','gestor','montador') then raise exception 'Sem permissão.';end if;
 if p_completed_at is null or p_completed_at>now()+interval '1 minute' then raise exception 'Informe quando o serviço ficou pronto, sem data futura.';end if;
 perform set_config('app.ready_import','on',true);
 select * into o from public.create_service_order(p_order->>'p_client_name',nullif(p_order->>'p_seller_id','')::uuid,(p_order->>'p_laboratory_id')::uuid,(p_order->>'p_entered_at')::timestamptz,null,p_order->>'p_notes',p_order->>'p_service_description',p_order->>'p_external_order_id',coalesce(p_order->>'p_priority','normal'),'pronto',coalesce(p_order->'p_lens_spec','{}'::jsonb),nullif(p_order->>'p_store_id','')::uuid);
 perform set_config('app.ready_import','off',true);
 perform set_config('app.status_write','on',true);
 update public.service_orders set completed_at=p_completed_at,updated_by=auth.uid() where id=o.id returning * into o;
 perform set_config('app.status_write','off',true);
 insert into public.order_status_history(order_id,from_status,to_status,note,user_id) values(o.id,null,'pronto','Cadastro posterior: serviço já pronto ao registrar passagem pelo laboratório. Etapas não marcadas como executadas.',auth.uid());
 return o;
end;$$;

create table if not exists public.client_delivery_followups(
 id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.service_orders(id),
 client_delivered_at timestamptz not null,followup_due_at timestamptz not null,
 client_phone text check(client_phone is null or client_phone~'^[0-9]{10,15}$'),
 confirmed_by uuid not null references auth.users(id),confirmed_at timestamptz not null default now(),
 contacted_at timestamptz,contacted_by uuid references auth.users(id),outcome text check(outcome in ('contato_realizado','adaptacao_ok','precisa_ajuda','sem_resposta')),feedback_note text,
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.client_delivery_followups enable row level security;
drop policy if exists client_delivery_followups_read on public.client_delivery_followups;
create policy client_delivery_followups_read on public.client_delivery_followups for select to authenticated using(public.current_app_role() in ('admin','gestor'));
revoke all on public.client_delivery_followups from anon,authenticated;
grant select on public.client_delivery_followups to authenticated;
create index if not exists client_followups_due_idx on public.client_delivery_followups(followup_due_at) where contacted_at is null;
create or replace function public.confirm_client_delivery(p_order_id uuid,p_phone text,p_delivered_at timestamptz)
returns public.client_delivery_followups language plpgsql security definer set search_path=public as $$
declare o public.service_orders; d public.client_delivery_followups; phone text;
begin
 if auth.uid() is null or coalesce(public.current_app_role(),'') not in ('admin','gestor') then raise exception 'Sem permissão para confirmar entrega ao cliente.';end if;
 if p_delivered_at is null or p_delivered_at>now()+interval '1 minute' then raise exception 'Informe a data real de entrega, sem data futura.';end if;
 phone:=nullif(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),'');
 if phone is not null and length(phone) not between 10 and 15 then raise exception 'Confira o telefone do cliente.';end if;
 select * into o from public.service_orders where id=p_order_id for update;
 if not found or o.status not in ('pronto','entregue') then raise exception 'Confirme a entrega somente de serviço pronto ou que saiu do laboratório.';end if;
 if coalesce(o.medical_review_required,false) and o.medical_review_approved_at is null then raise exception 'Aguarde a liberação médica antes de entregar.';end if;
 select * into d from public.client_delivery_followups where order_id=o.id;
 if found then raise exception 'Entrega ao cliente já confirmada. O prazo do pós-venda não será reiniciado.';end if;
 if o.status='pronto' then perform public.change_order_status(o.id,'entregue','Entrega ao cliente confirmada explicitamente');end if;
 insert into public.client_delivery_followups(order_id,client_delivered_at,followup_due_at,client_phone,confirmed_by) values(o.id,p_delivered_at,p_delivered_at+interval '120 hours',phone,auth.uid()) returning * into d;
 insert into public.order_status_history(order_id,from_status,to_status,note,user_id) values(o.id,'entregue','entregue','Entrega ao cliente confirmada. Acompanhamento previsto após cinco dias corridos.',auth.uid());
 return d;
end;$$;
create or replace function public.update_client_followup(p_id uuid,p_outcome text,p_note text,p_phone text,p_expected_updated_at timestamptz)
returns public.client_delivery_followups language plpgsql security definer set search_path=public as $$
declare d public.client_delivery_followups; o public.service_orders; phone text;
begin
 if auth.uid() is null or coalesce(public.current_app_role(),'') not in ('admin','gestor') then raise exception 'Sem permissão.';end if;
 select * into d from public.client_delivery_followups where id=p_id for update;
 if not found or p_expected_updated_at is null or d.updated_at is distinct from p_expected_updated_at then raise exception 'Atualize a tela antes de registrar o acompanhamento.';end if;
 if p_outcome is not null and p_outcome not in ('contato_realizado','adaptacao_ok','precisa_ajuda','sem_resposta') then raise exception 'Resultado inválido.';end if;
 if length(coalesce(p_note,''))>2000 then raise exception 'Use até 2000 caracteres.';end if;
 phone:=nullif(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),'');
 if phone is not null and length(phone) not between 10 and 15 then raise exception 'Confira o telefone.';end if;
 update public.client_delivery_followups set client_phone=phone,outcome=coalesce(p_outcome,outcome),feedback_note=nullif(trim(coalesce(p_note,'')),''),contacted_at=case when p_outcome is not null then coalesce(contacted_at,now()) else contacted_at end,contacted_by=case when p_outcome is not null then auth.uid() else contacted_by end,updated_at=clock_timestamp() where id=d.id returning * into d;
 select * into o from public.service_orders where id=d.order_id;
 insert into public.order_status_history(order_id,from_status,to_status,note,user_id) values(o.id,o.status,o.status,case when p_outcome is null then 'Contato do pós-venda atualizado' else 'Pós-venda registrado: '||p_outcome end,auth.uid());
 return d;
end;$$;

revoke all on function public.register_order_stage_note(uuid,text,text,boolean) from public,anon;
grant execute on function public.register_order_stage_note(uuid,text,text,boolean) to authenticated;

revoke all on function public.create_ready_service_order(jsonb,timestamptz) from public,anon;
grant execute on function public.create_ready_service_order(jsonb,timestamptz) to authenticated;

revoke all on function public.confirm_client_delivery(uuid,text,timestamptz) from public,anon;
grant execute on function public.confirm_client_delivery(uuid,text,timestamptz) to authenticated;

revoke all on function public.update_client_followup(uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.update_client_followup(uuid,text,text,text,timestamptz) to authenticated;
commit;
