-- Profiles are private to their owner. Email lives in auth.users, not public.profiles.

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;

drop policy if exists "Users can select own profile." on public.profiles;

create policy "Users can select own profile."
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (id, author_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'author_name', new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$function$;

alter table public.profiles drop column if exists email;
