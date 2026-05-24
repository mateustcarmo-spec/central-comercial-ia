create or replace function public.profile_display_name(
  profile_email text,
  metadata jsonb
)
returns text
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(metadata->>'name', ''),
      nullif(metadata->>'full_name', ''),
      nullif(split_part(coalesce(profile_email, ''), '@', 1), '')
    ),
    ''
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    role,
    last_access_at
  )
  values (
    new.id,
    new.email,
    public.profile_display_name(new.email, new.raw_user_meta_data),
    'consultor',
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(
          nullif(public.profiles.display_name, ''),
          excluded.display_name
        ),
        last_access_at = coalesce(public.profiles.last_access_at, excluded.last_access_at);

  return new;
end;
$$;

create or replace function public.register_profile_access()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := auth.jwt()->>'email';
begin
  if current_user_id is null then
    return;
  end if;

  insert into public.profiles (
    id,
    email,
    display_name,
    role,
    access_count,
    last_access_at,
    ai_model
  )
  values (
    current_user_id,
    current_email,
    public.profile_display_name(current_email, '{}'::jsonb),
    'consultor',
    1,
    now(),
    'gpt-4o-mini'
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        display_name = coalesce(
          nullif(public.profiles.display_name, ''),
          excluded.display_name
        ),
        access_count = public.profiles.access_count + 1,
        last_access_at = now();
end;
$$;

update public.profiles
set display_name = public.profile_display_name(email, '{}'::jsonb)
where display_name is null
   or btrim(display_name) = '';

grant execute on function public.profile_display_name(text, jsonb) to authenticated;
grant execute on function public.register_profile_access() to authenticated;
