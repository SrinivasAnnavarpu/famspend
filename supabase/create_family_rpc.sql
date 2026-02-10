create or replace function public.create_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_user uuid;
  v_family_id uuid;
begin
  v_user := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.families (name, base_currency, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'My Family'), 'USD', v_user)
  returning id into v_family_id;

  insert into public.family_members (family_id, user_id, role)
  values (v_family_id, v_user, 'owner');

  insert into public.categories (family_id, name, sort_order)
  values
    (v_family_id, 'Food', 0),
    (v_family_id, 'Rent', 1),
    (v_family_id, 'Utilities', 2),
    (v_family_id, 'Travel', 3),
    (v_family_id, 'Shopping', 4),
    (v_family_id, 'Health', 5),
    (v_family_id, 'Other', 6)
  on conflict do nothing;

  return v_family_id;
end;
$func$;

grant execute on function public.create_family(text) to authenticated;
