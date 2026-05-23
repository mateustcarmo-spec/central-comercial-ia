create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'consultor',
  profile_type text,
  access_count integer not null default 0,
  last_access_at timestamptz,
  ai_model text not null default 'gpt-4o-mini',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('admin', 'consultor'))
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists role text not null default 'consultor',
  add column if not exists profile_type text,
  add column if not exists access_count integer not null default 0,
  add column if not exists last_access_at timestamptz,
  add column if not exists ai_model text not null default 'gpt-4o-mini',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('admin', 'consultor'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_profile_type_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_profile_type_check check (profile_type is null or profile_type in ('admin', 'consultor'));
  end if;
end $$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where (id = auth.uid() or email = auth.jwt()->>'email')
      and (role = 'admin' or profile_type = 'admin')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    'consultor'
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

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
    role,
    access_count,
    last_access_at,
    ai_model
  )
  values (
    current_user_id,
    current_email,
    'consultor',
    1,
    now(),
    'gpt-4o-mini'
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        access_count = public.profiles.access_count + 1,
        last_access_at = now();
end;
$$;

insert into public.profiles (id, email, display_name, role)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name'),
  'consultor'
from auth.users
on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(public.profiles.display_name, excluded.display_name);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or email = auth.jwt()->>'email' or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() and coalesce(role, 'consultor') = 'consultor');

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "conversations_select_own_or_admin" on public.conversations;
create policy "conversations_select_own_or_admin"
on public.conversations
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own"
on public.conversations
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "conversations_update_own_or_admin" on public.conversations;
create policy "conversations_update_own_or_admin"
on public.conversations
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "conversations_delete_own_or_admin" on public.conversations;
create policy "conversations_delete_own_or_admin"
on public.conversations
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "messages_select_own_or_admin" on public.messages;
create policy "messages_select_own_or_admin"
on public.messages
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
on public.messages
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "messages_update_own_or_admin" on public.messages;
create policy "messages_update_own_or_admin"
on public.messages
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "messages_delete_own_or_admin" on public.messages;
create policy "messages_delete_own_or_admin"
on public.messages
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

grant execute on function public.register_profile_access() to authenticated;
grant execute on function public.is_admin() to authenticated;
