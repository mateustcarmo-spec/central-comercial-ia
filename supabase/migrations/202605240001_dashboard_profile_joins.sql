insert into public.profiles (id, email, display_name, role)
select
  users.id,
  users.email,
  nullif(
    coalesce(
      users.raw_user_meta_data->>'name',
      users.raw_user_meta_data->>'full_name'
    ),
    ''
  ),
  'consultor'
from auth.users
where users.id in (
  select conversations.user_id from public.conversations
  union
  select messages.user_id from public.messages
)
on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email),
      display_name = coalesce(
        nullif(public.profiles.display_name, ''),
        excluded.display_name
      );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_user_id_profiles_id_fkey'
      and conrelid = 'public.conversations'::regclass
  ) then
    alter table public.conversations
      add constraint conversations_user_id_profiles_id_fkey
      foreign key (user_id)
      references public.profiles(id)
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_user_id_profiles_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_user_id_profiles_id_fkey
      foreign key (user_id)
      references public.profiles(id)
      not valid;
  end if;
end $$;

notify pgrst, 'reload schema';
