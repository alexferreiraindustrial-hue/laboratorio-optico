-- Admin cria usuários internos pelo JWT autenticado, sem service_role no app.
create or replace function public.create_staff_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid uuid := gen_random_uuid();
  email_norm text := lower(trim(p_email));
  name_norm text := trim(p_full_name);
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Apenas o administrador cadastra usuários internos.';
  end if;
  if p_role not in ('admin', 'gestor', 'montador', 'estoquista', 'consulta') then
    raise exception 'Perfil de acesso inválido.';
  end if;
  if email_norm is null or position('@' in email_norm) = 0 then
    raise exception 'Informe um e-mail válido.';
  end if;
  if char_length(p_password) < 8 then
    raise exception 'A senha precisa ter pelo menos 8 caracteres.';
  end if;
  if char_length(name_norm) < 3 then
    raise exception 'Informe o nome completo.';
  end if;
  if exists (select 1 from auth.users where lower(email) = email_norm) then
    raise exception 'Já existe um usuário com este e-mail.';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    uid,
    'authenticated',
    'authenticated',
    email_norm,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', name_norm),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at,
    email
  ) values (
    gen_random_uuid(),
    uid,
    jsonb_build_object('sub', uid::text, 'email', email_norm),
    'email',
    uid::text,
    now(),
    now(),
    now(),
    email_norm
  );

  update public.profiles
  set full_name = name_norm, role = p_role, active = true
  where id = uid;

  if not found then
    insert into public.profiles (id, full_name, role, active)
    values (uid, name_norm, p_role, true);
  end if;

  return uid;
end;
$$;

revoke all on function public.create_staff_user(text, text, text, text) from public;
grant execute on function public.create_staff_user(text, text, text, text) to authenticated;
