-- Conversa da OS: o laboratório responde em sequência, além do recado único do vendedor.
-- Áudio entra no mesmo bucket das fotos.

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/wav'
]
where id = 'lab-files';

create table if not exists public.order_chat_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders (id) on delete restrict,
  author_kind text not null check (author_kind in ('lab', 'seller', 'store')),
  author_label text not null check (char_length(author_label) between 1 and 80),
  body text,
  audio_path text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint order_chat_has_content check (
    (body is not null and char_length(btrim(body)) between 1 and 800)
    or (audio_path is not null and char_length(audio_path) between 3 and 300)
  )
);

create index if not exists order_chat_messages_order_idx
  on public.order_chat_messages (order_id, created_at);

alter table public.order_chat_messages enable row level security;

drop policy if exists order_chat_select on public.order_chat_messages;
create policy order_chat_select on public.order_chat_messages
  for select to authenticated
  using (public.current_app_role() is not null);

drop policy if exists order_chat_insert on public.order_chat_messages;
create policy order_chat_insert on public.order_chat_messages
  for insert to authenticated
  with check (
    public.current_app_role() in ('admin', 'gestor', 'montador')
    and author_kind = 'lab'
  );

grant select, insert on public.order_chat_messages to authenticated, service_role;

-- O portal do vendedor passa a ver o texto da conversa junto com os recados.
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
      select jsonb_agg(item order by created_at)
      from (
        select jsonb_build_object(
          'id', m.id,
          'sender_kind', m.sender_kind,
          'sender_label', m.sender_label,
          'body', m.body,
          'status', m.status,
          'created_at', m.created_at,
          'reply_body', m.reply_body,
          'replied_at', m.replied_at
        ) as item,
        m.created_at
        from public.order_messages m
        where m.order_id = v_order.id
        union all
        select jsonb_build_object(
          'id', c.id,
          'sender_kind', c.author_kind,
          'sender_label', c.author_label,
          'body', coalesce(nullif(btrim(c.body), ''), 'Áudio'),
          'status', 'chat',
          'created_at', c.created_at,
          'reply_body', null,
          'replied_at', null
        ),
        c.created_at
        from public.order_chat_messages c
        where c.order_id = v_order.id
      ) thread
    ), '[]'::jsonb)
  );
end;
$$;
