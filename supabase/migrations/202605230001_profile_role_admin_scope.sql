alter table public.profiles
  add column if not exists profile_type text;

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

drop policy if exists "conversations_select_own_or_admin" on public.conversations;
create policy "conversations_select_own_or_admin"
on public.conversations
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "messages_select_own_or_admin" on public.messages;
create policy "messages_select_own_or_admin"
on public.messages
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

grant execute on function public.is_admin() to authenticated;
