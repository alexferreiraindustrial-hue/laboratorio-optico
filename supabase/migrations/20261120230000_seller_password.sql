-- Aceita senhas e preserva PINs e hashes existentes. Não modifica registros.
begin;
create or replace function public.set_seller_app_access(p_seller_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code integer;
  v_name text;
begin
  if coalesce(public.current_app_role(), '') not in ('admin', 'gestor') then
    raise exception 'Apenas administrador ou gestor cria o acesso do vendedor.';
  end if;
  if p_pin is null or char_length(p_pin) < 4 or octet_length(p_pin) > 64 or btrim(p_pin) = '' then
    raise exception 'Use pelo menos 4 caracteres e no máximo 64 bytes.';
  end if;
  update public.sellers
  set access_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
  where id = p_seller_id and active
  returning quick_code, name into v_code, v_name;
  if not found then
    raise exception 'Vendedor não encontrado ou inativo.';
  end if;
  return jsonb_build_object(
    'ok', true,
    'name', v_name,
    'login', 'v' || v_code::text
  );
end;
$$;

create or replace function public.seller_app_login(p_login text, p_pin text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller public.sellers;
  v_token text;
  v_hash text;
  v_code text;
begin
  if p_ip_hash is not null and length(p_ip_hash) >= 8 then
    perform public.portal_rate_hit('seller-login:' || p_ip_hash, 20, interval '10 minutes');
  end if;
  if p_pin is null or char_length(p_pin) < 4 or octet_length(p_pin) > 64 or btrim(p_pin) = '' then
    raise exception 'Código ou senha inválidos.';
  end if;
  v_code := lower(btrim(coalesce(p_login, '')));
  if v_code ~ '^v?[0-9]{1,3}$' then
    v_code := regexp_replace(v_code, '^v', '');
    select * into v_seller from public.sellers where quick_code = v_code::int and active limit 1;
  else
    select * into v_seller from public.sellers where lower(coalesce(email, '')) = v_code and active limit 1;
  end if;
  if not found or v_seller.access_pin_hash is null then
    raise exception 'Código ou senha inválidos.';
  end if;
  if v_seller.access_pin_hash <> extensions.crypt(p_pin, v_seller.access_pin_hash) then
    raise exception 'Código ou senha inválidos.';
  end if;

  update public.portal_credentials
  set revoked_at = now()
  where seller_id = v_seller.id and access_kind = 'app' and revoked_at is null;

  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  insert into public.portal_credentials (
    subject_type, seller_id, token_hash, token_prefix, access_kind
  ) values (
    'seller', v_seller.id, v_hash, left(v_token, 6), 'app'
  );

  return jsonb_build_object(
    'token', v_token,
    'kind', 'vendedor',
    'name', v_seller.name,
    'login', 'v' || v_seller.quick_code::text
  );
end;
$$;

revoke all on function public.set_seller_app_access(uuid, text) from public, anon;
revoke all on function public.seller_app_login(text, text, text) from public;
grant execute on function public.set_seller_app_access(uuid, text) to authenticated;
grant execute on function public.seller_app_login(text, text, text) to anon, authenticated;

commit;
