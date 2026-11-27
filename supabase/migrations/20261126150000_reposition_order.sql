-- Reposicionar uma OS (correção pelo bipe e auditoria): leva a OS de qualquer etapa em aberto
-- para a posição onde ela realmente está, sem bloquear. Ex.: dei pronto por engano, foi para o
-- médico e voltou para a montagem, lente marcada errada, VTA.
-- Aditiva: só cria uma função nova. Não altera tabelas, colunas nem o histórico existente.
-- Cada uso grava no histórico quem mudou, de onde, para onde e por quê.
begin;
set local lock_timeout = '5s';

create or replace function public.reposition_order(p_order_id uuid, p_to text, p_note text)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.service_orders;
  v_from text;
  v_status text;
  v_note text := trim(coalesce(p_note, ''));
  v_extra text := '';
begin
  if auth.uid() is null or coalesce(public.current_app_role(), '') not in ('admin', 'gestor', 'montador') then
    raise exception 'Seu acesso não muda a posição da OS.';
  end if;
  if p_to is null or p_to not in ('aguardando_lentes', 'vta', 'aguardando_montagem', 'em_montagem', 'em_conferencia', 'pronto') then
    raise exception 'Posição desconhecida.';
  end if;
  if length(v_note) < 3 then
    raise exception 'Informe o motivo da mudança.';
  end if;
  if length(v_note) > 500 then
    raise exception 'Use até 500 caracteres no motivo.';
  end if;

  select * into o from public.service_orders where id = p_order_id for update;
  if not found then
    raise exception 'OS não encontrada.';
  end if;
  v_from := o.status;
  if v_from not in ('aguardando_lentes', 'aguardando_montagem', 'em_montagem', 'em_correcao', 'em_conferencia', 'pronto') then
    raise exception 'Esta OS já foi entregue ou cancelada; abra a OS para corrigir.';
  end if;

  v_status := case when p_to = 'vta' then 'aguardando_lentes' else p_to end;
  if v_status = v_from
     and (p_to <> 'vta' or (o.frame_state = 'vta' and o.lens_arrived_at is not null))
     and not (p_to = 'aguardando_lentes' and (o.lens_arrived_at is not null or o.frame_state = 'vta')) then
    raise exception 'A OS já está nesta posição.';
  end if;

  if p_to = 'aguardando_lentes' and o.lens_arrived_at is not null then
    v_extra := ' · chegada da lente registrada antes: ' || to_char(o.lens_arrived_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
  end if;

  perform set_config('app.status_write', 'on', true);
  perform set_config('app.followup_write', 'on', true);
  update public.service_orders
  set status = v_status,
      completed_at = case
        when v_status = 'pronto' then coalesce(completed_at, clock_timestamp())
        when v_from = 'pronto' then null
        else completed_at end,
      lens_arrived_at = case
        when p_to = 'aguardando_lentes' then null
        when p_to = 'vta' then coalesce(lens_arrived_at, clock_timestamp())
        when v_status in ('aguardando_montagem', 'em_montagem', 'em_conferencia', 'pronto') then coalesce(lens_arrived_at, clock_timestamp())
        else lens_arrived_at end,
      -- VTA só existe esperando a armação; nas outras posições a armação já está no laboratório.
      frame_state = case
        when p_to = 'vta' then 'vta'
        when frame_state = 'vta' then 'present'
        else frame_state end,
      -- Médico: ir para conferência marca que precisa de retorno; achar na gaveta de prontos
      -- registra o retorno; voltar para outra etapa encerra a conferência pendente.
      medical_review_required = case
        when v_status = 'em_conferencia' then true
        when v_from = 'em_conferencia' and v_status <> 'pronto' then false
        else medical_review_required end,
      medical_review_approved_at = case
        when v_status = 'em_conferencia' then null
        when v_status = 'pronto' and coalesce(medical_review_required, false) and medical_review_approved_at is null then clock_timestamp()
        else medical_review_approved_at end,
      updated_by = auth.uid()
  where id = o.id
  returning * into o;
  perform set_config('app.status_write', 'off', true);
  perform set_config('app.followup_write', 'off', true);

  if v_status = 'em_montagem' then
    perform public.ensure_assembly_steps(o.id);
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, note, user_id)
  values (
    o.id, v_from, v_status,
    case when v_from = 'pronto' then 'Pronto desfeito: ' else 'Posição corrigida: ' end
      || case when p_to = 'vta' then '[VTA · lente chegou, aguardando armação] ' else '' end
      || v_note || v_extra,
    auth.uid()
  );

  return o;
end;
$$;

revoke all on function public.reposition_order(uuid, text, text) from public, anon;
grant execute on function public.reposition_order(uuid, text, text) to authenticated;

commit;
