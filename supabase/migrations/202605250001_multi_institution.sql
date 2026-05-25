alter table public.profiles
  add column if not exists institution text not null default 'unicesumar';

alter table public.conversations
  add column if not exists institution text not null default 'unicesumar';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_institution_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_institution_check
      check (institution in ('unicesumar', 'unifecaf'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_institution_check'
      and conrelid = 'public.conversations'::regclass
  ) then
    alter table public.conversations
      add constraint conversations_institution_check
      check (institution in ('unicesumar', 'unifecaf'));
  end if;
end $$;

create or replace function public.current_profile_institution()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select institution
      from public.profiles
      where id = auth.uid() or email = auth.jwt()->>'email'
      limit 1
    ),
    'unicesumar'
  );
$$;

drop policy if exists "profiles_update_own_basic" on public.profiles;
create policy "profiles_update_own_basic"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and coalesce(role, 'consultor') = 'consultor');

drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own"
on public.conversations
for insert
to authenticated
with check (
  public.is_admin()
  or (user_id = auth.uid() and institution = public.current_profile_institution())
);

drop policy if exists "conversations_update_own_or_admin" on public.conversations;
create policy "conversations_update_own_or_admin"
on public.conversations
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (user_id = auth.uid() and institution = public.current_profile_institution())
);

grant execute on function public.current_profile_institution() to authenticated;
