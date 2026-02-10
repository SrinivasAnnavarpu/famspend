create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  token text not null unique,
  expires_at timestamptz not null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.family_invites enable row level security;

drop policy if exists "family_invites_select_owner" on public.family_invites;
drop policy if exists "family_invites_insert_owner" on public.family_invites;

create policy "family_invites_select_owner"
on public.family_invites
for select
using (
  exists (
    select 1 from public.families f
    where f.id = family_invites.family_id
      and f.created_by = auth.uid()
  )
);

create policy "family_invites_insert_owner"
on public.family_invites
for insert
to authenticated
with check (
  exists (
    select 1 from public.families f
    where f.id = family_id
      and f.created_by = auth.uid()
  )
  and created_by = auth.uid()
);

grant select, insert on public.family_invites to authenticated;

drop function if exists public.create_invite(uuid);
create or replace function public.create_invite(p_family_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_user uuid;
  v_token text;
  v_is_owner boolean;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select exists(select 1 from public.families f where f.id = p_family_id and f.created_by = v_user)
  into v_is_owner;
  if not v_is_owner then
    raise exception 'not allowed';
  end if;

  v_token := encode(gen_random_bytes(16), 'hex');

  insert into public.family_invites (family_id, created_by, token, expires_at)
  values (p_family_id, v_user, v_token, now() + interval '7 days');

  return v_token;
end;
$func$;

grant execute on function public.create_invite(uuid) to authenticated;

drop function if exists public.accept_invite(text);
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_user uuid;
  v_family uuid;
  v_expires timestamptz;
  v_used_at timestamptz;
  v_already boolean;
  v_has_family boolean;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select family_id, expires_at, used_at
  into v_family, v_expires, v_used_at
  from public.family_invites
  where token = p_token;

  if v_family is null then
    raise exception 'invalid invite';
  end if;

  if v_used_at is not null then
    raise exception 'invite already used';
  end if;

  if v_expires < now() then
    raise exception 'invite expired';
  end if;

  select exists(select 1 from public.family_members fm where fm.user_id = v_user)
  into v_has_family;
  if v_has_family then
    raise exception 'already in a family';
  end if;

  select exists(select 1 from public.family_members fm where fm.family_id = v_family and fm.user_id = v_user)
  into v_already;

  if not v_already then
    insert into public.family_members (family_id, user_id, role)
    values (v_family, v_user, 'member');
  end if;

  update public.family_invites
  set used_by = v_user,
      used_at = now()
  where token = p_token
    and used_at is null;

  return v_family;
end;
$func$;

grant execute on function public.accept_invite(text) to authenticated;
