begin;
set local lock_timeout='5s';
alter table public.service_orders
 add column if not exists medical_review_required boolean,
 add column if not exists medical_review_approved_at timestamptz,
 add column if not exists medical_review_note text,
 add column if not exists assistance_kind text check(assistance_kind in ('garantia','refacao','prescricao','outro')),
 add column if not exists assistance_origin_order_id uuid references public.service_orders(id);
create or replace function public.guard_medical_assistance() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='INSERT' then
  if new.medical_review_approved_at is not null then raise exception 'Use o registro de retorno médico.'; end if;
 else
  if (new.medical_review_required is distinct from old.medical_review_required or new.medical_review_approved_at is distinct from old.medical_review_approved_at or new.medical_review_note is distinct from old.medical_review_note or new.assistance_kind is distinct from old.assistance_kind or new.assistance_origin_order_id is distinct from old.assistance_origin_order_id)
   and current_setting('app.followup_write',true) is distinct from 'on' then raise exception 'Use o acompanhamento para alterar a conferência médica ou assistência.'; end if;
  if new.status is distinct from old.status and new.status in ('em_correcao','em_montagem','aguardando_montagem','aguardando_lentes') then new.medical_review_approved_at:=null; new.medical_review_note:=null; end if;
 end if;
 if new.assistance_origin_order_id=new.id then raise exception 'A OS original deve ser outro serviço.'; end if;
 if coalesce(new.medical_review_required,false) and new.medical_review_approved_at is null and new.status in ('pronto','entregue') then raise exception 'Aguardando liberação médica: não avise como pronto nem entregue.'; end if;
 return new;
end; $$;
drop trigger if exists orders_medical_assistance_guard on public.service_orders;
create trigger orders_medical_assistance_guard before insert or update on public.service_orders for each row execute function public.guard_medical_assistance();

create or replace function public.configure_medical_review(p_order_id uuid,p_required boolean,p_expected_updated_at timestamptz)
returns public.service_orders language plpgsql security definer set search_path=public as $$
declare o public.service_orders;
begin
 if auth.uid() is null or coalesce(public.current_app_role(),'') not in ('admin','gestor','montador') then raise exception 'Sem permissão.'; end if;
 select * into o from public.service_orders where id=p_order_id for update;
 if not found then raise exception 'OS não encontrada.'; end if;
 if p_required is null or p_expected_updated_at is null or o.updated_at is distinct from p_expected_updated_at then raise exception 'OS alterada por outra pessoa. Atualize a tela.'; end if;
 if o.status in ('pronto','entregue','cancelado') then raise exception 'Serviço encerrado: registre uma assistência separada.'; end if;
 if coalesce(o.medical_review_required,false)=p_required then return o; end if;
 perform set_config('app.followup_write','on',true);
 update public.service_orders set medical_review_required=p_required,medical_review_approved_at=null,medical_review_note=null,updated_by=auth.uid() where id=o.id returning * into o;
 perform set_config('app.followup_write','off',true);
 insert into public.order_status_history(order_id,from_status,to_status,note,user_id) values(o.id,o.status,o.status,case when p_required then 'Marcado: precisa passar pela conferência médica' else 'Indicação de conferência médica removida' end,auth.uid());
 return o;
end; $$;

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
 if (select count(*) from public.assembly_steps where order_id=o.id and status='concluida')<5 then raise exception 'Conclua as cinco etapas antes da liberação médica.'; end if;
 if exists(select 1 from public.quality_occurrences where order_id=o.id and status in ('aberta','em_tratamento')) then raise exception 'Resolva as ocorrências antes da liberação médica.'; end if;
 perform set_config('app.followup_write','on',true);
 update public.service_orders set medical_review_approved_at=now(),medical_review_note=trim(p_note),updated_by=auth.uid() where id=o.id returning * into o;
 perform set_config('app.followup_write','off',true);
 insert into public.order_status_history(order_id,from_status,to_status,note,user_id) values(o.id,o.status,o.status,'Retorno médico registrado: '||trim(p_note),auth.uid());
 select * into o from public.change_order_status(o.id,'pronto','Liberado após retorno da conferência médica');
 return o;
end; $$;

create or replace function public.create_service_order_followup(p_order jsonb,p_frame_state text,p_express_minutes integer,p_medical_required boolean)
returns public.service_orders language plpgsql security definer set search_path=public as $$
declare o public.service_orders;
begin
 if auth.uid() is null or coalesce(public.current_app_role(),'') not in ('admin','gestor','montador') then raise exception 'Sem permissão.'; end if;
 select * into o from public.create_service_order_configured(p_order,p_frame_state,p_express_minutes);
 if coalesce(p_medical_required,false) then select * into o from public.configure_medical_review(o.id,true,o.updated_at); end if;
 return o;
end; $$;

create or replace function public.create_assistance_order(p_original_number text,p_kind text,p_description text,p_due_at timestamptz,p_needs_lenses boolean,p_medical_required boolean)
returns public.service_orders language plpgsql security definer set search_path=public as $$
declare original public.service_orders; o public.service_orders; matches integer;
begin
 if auth.uid() is null or coalesce(public.current_app_role(),'') not in ('admin','gestor','montador') then raise exception 'Sem permissão.'; end if;
 if p_kind is null or p_kind not in ('garantia','refacao','prescricao','outro') then raise exception 'Escolha o motivo da assistência.'; end if;
 if length(trim(coalesce(p_description,'')))<3 or length(p_description)>500 then raise exception 'Descreva a assistência em 3 a 500 caracteres.'; end if;
 if p_due_at is null or p_due_at<=now() or p_needs_lenses is null then raise exception 'Informe o prazo futuro e a necessidade de lentes.'; end if;
 select count(*) into matches from public.service_orders where number=trim(p_original_number);
 if matches<>1 then raise exception 'Informe o número exato e único da OS original, disponível nos detalhes do serviço.'; end if;
 select * into original from public.service_orders where number=trim(p_original_number) for update;
 if original.status='cancelado' then raise exception 'A OS original está cancelada.'; end if;
 select * into o from public.create_service_order(original.client_name,original.seller_id,original.laboratory_id,now(),p_due_at,'Assistência vinculada à OS '||original.number,trim(p_description),null,'normal',case when p_needs_lenses then 'aguardando_lentes' else 'aguardando_montagem' end,'{}'::jsonb,original.store_id);
 perform set_config('app.followup_write','on',true);
 update public.service_orders set assistance_kind=p_kind,assistance_origin_order_id=original.id,medical_review_required=coalesce(p_medical_required,false),updated_by=auth.uid() where id=o.id returning * into o;
 perform set_config('app.followup_write','off',true);
 insert into public.order_status_history(order_id,from_status,to_status,note,user_id) values(o.id,o.status,o.status,'Assistência ('||p_kind||') da OS '||original.number||': '||trim(p_description),auth.uid());
 return o;
end; $$;

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
    or (v_from = 'aguardando_montagem' and p_to in ('em_montagem', 'aguardando_lentes', 'cancelado'))
    or (v_from = 'em_montagem' and p_to in ('pronto', 'em_correcao', 'em_conferencia', 'aguardando_montagem', 'cancelado'))
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
revoke all on function public.configure_medical_review(uuid,boolean,timestamptz) from public,anon;
grant execute on function public.configure_medical_review(uuid,boolean,timestamptz) to authenticated;
revoke all on function public.approve_medical_review(uuid,text,timestamptz) from public,anon;
grant execute on function public.approve_medical_review(uuid,text,timestamptz) to authenticated;
revoke all on function public.create_service_order_followup(jsonb,text,integer,boolean) from public,anon;
grant execute on function public.create_service_order_followup(jsonb,text,integer,boolean) to authenticated;
revoke all on function public.create_assistance_order(text,text,text,timestamptz,boolean,boolean) from public,anon;
grant execute on function public.create_assistance_order(text,text,text,timestamptz,boolean,boolean) to authenticated;
commit;
