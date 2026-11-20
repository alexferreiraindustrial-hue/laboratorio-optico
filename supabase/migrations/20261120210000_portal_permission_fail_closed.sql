-- Ownership checks must always return false, never NULL, for unassigned orders.
-- Keeps the existing seller/store scope and changes no records or grants.
create or replace function public.portal_can_see(
  p_cred public.portal_credentials,
  p_order public.service_orders
)
returns boolean
language sql
stable
as $$
  select coalesce(case
    when p_cred.subject_type = 'store' then p_order.store_id = p_cred.store_id
    when p_cred.subject_type = 'seller' then p_order.seller_id = p_cred.seller_id
    else false
  end, false);
$$;

-- Verify ownership boundaries without inserting any production records.
do $$
declare
  credential public.portal_credentials;
  service_order public.service_orders;
begin
  credential.subject_type := 'seller';
  credential.seller_id := '00000000-0000-4000-8000-000000000001';
  service_order.seller_id := credential.seller_id;
  if public.portal_can_see(credential, service_order) is distinct from true then
    raise exception 'Seller must see own order';
  end if;
  service_order.seller_id := '00000000-0000-4000-8000-000000000002';
  if public.portal_can_see(credential, service_order) is distinct from false then
    raise exception 'Seller must not see another seller order';
  end if;
  service_order.seller_id := null;
  if public.portal_can_see(credential, service_order) is distinct from false then
    raise exception 'Seller must not see unassigned order';
  end if;
  credential.subject_type := 'store';
  credential.store_id := '00000000-0000-4000-8000-000000000003';
  service_order.store_id := credential.store_id;
  if public.portal_can_see(credential, service_order) is distinct from true then
    raise exception 'Store must see own order';
  end if;
  service_order.store_id := null;
  if public.portal_can_see(credential, service_order) is distinct from false then
    raise exception 'Store must not see unassigned order';
  end if;
end;
$$;
