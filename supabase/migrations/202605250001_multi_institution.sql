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

create or replace function public.normalize_institution(institution_value text)
returns text
language sql
immutable
as $$
  select case
    when institution_value = 'unifecaf' then 'unifecaf'
    else 'unicesumar'
  end;
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
    institution,
    role,
    last_access_at
  )
  values (
    new.id,
    new.email,
    public.profile_display_name(new.email, new.raw_user_meta_data),
    public.normalize_institution(new.raw_user_meta_data->>'institution'),
    'consultor',
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(
          nullif(public.profiles.display_name, ''),
          excluded.display_name
        ),
        institution = public.profiles.institution,
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
  current_institution text := public.normalize_institution(
    auth.jwt()->'user_metadata'->>'institution'
  );
begin
  if current_user_id is null then
    return;
  end if;

  insert into public.profiles (
    id,
    email,
    display_name,
    institution,
    role,
    access_count,
    last_access_at,
    ai_model
  )
  values (
    current_user_id,
    current_email,
    public.profile_display_name(current_email, '{}'::jsonb),
    current_institution,
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
        institution = public.profiles.institution,
        access_count = public.profiles.access_count + 1,
        last_access_at = now();
end;
$$;

create or replace function public.can_update_own_profile(
  candidate_id uuid,
  candidate_role text,
  candidate_institution text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select candidate_id = auth.uid()
    and coalesce(candidate_role, 'consultor') = 'consultor'
    and public.normalize_institution(candidate_institution) = coalesce(
      (
        select profiles.institution
        from public.profiles
        where profiles.id = auth.uid()
        limit 1
      ),
      public.normalize_institution(candidate_institution)
    );
$$;

drop policy if exists "profiles_update_own_basic" on public.profiles;
create policy "profiles_update_own_basic"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (public.can_update_own_profile(id, role, institution));

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
grant execute on function public.normalize_institution(text) to authenticated;
grant execute on function public.can_update_own_profile(uuid, text, text) to authenticated;
