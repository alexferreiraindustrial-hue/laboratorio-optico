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
  late boolean,
  priority text
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
    (o.due_at is not null and o.due_at < now() and o.status not in ('entregue', 'cancelado')),
    o.priority
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

grant execute on function public.portal_orders(text, text, text, uuid, text, date, date, boolean, boolean) to anon, authenticated;
