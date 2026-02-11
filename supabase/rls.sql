-- RLS hardening (owner vs member + row ownership)
-- Apply in Supabase SQL editor.
--
-- Rules:
-- - Expenses: family members can read; insert only as themselves; update/delete own expenses; owner can update/delete any
-- - Categories: family members can read + create + edit within their family
-- - Families: members can read; only owner can update
--
-- Uses SECURITY DEFINER helper functions with row_security=off to avoid recursive RLS policies.

begin;

-- ===== Helper functions (avoid RLS recursion) =====
create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = auth.uid()
  );
$$;

create or replace function public.is_family_owner(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.families f
    where f.id = p_family_id
      and f.created_by = auth.uid()
  );
$$;

grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.is_family_owner(uuid) to authenticated;

-- =================================================
-- EXPENSES RLS
-- =================================================
alter table public.expenses enable row level security;

drop policy if exists expenses_select_member on public.expenses;
drop policy if exists expenses_insert_member on public.expenses;
drop policy if exists expenses_update_own_or_owner on public.expenses;
drop policy if exists expenses_delete_own_or_owner on public.expenses;

create policy expenses_select_member
on public.expenses
for select
to authenticated
using (
  public.is_family_member(family_id)
);

create policy expenses_insert_member
on public.expenses
for insert
to authenticated
with check (
  public.is_family_member(family_id)
  and created_by = auth.uid()
);

create policy expenses_update_own_or_owner
on public.expenses
for update
to authenticated
using (
  public.is_family_member(family_id)
  and (created_by = auth.uid() or public.is_family_owner(family_id))
)
with check (
  public.is_family_member(family_id)
  and (created_by = auth.uid() or public.is_family_owner(family_id))
);

create policy expenses_delete_own_or_owner
on public.expenses
for delete
to authenticated
using (
  public.is_family_member(family_id)
  and (created_by = auth.uid() or public.is_family_owner(family_id))
);

grant select, insert, update, delete on public.expenses to authenticated;

-- =================================================
-- CATEGORIES RLS
-- =================================================
alter table public.categories enable row level security;

drop policy if exists categories_select_member on public.categories;
drop policy if exists categories_insert_member on public.categories;
drop policy if exists categories_update_member on public.categories;

create policy categories_select_member
on public.categories
for select
to authenticated
using (
  public.is_family_member(family_id)
);

create policy categories_insert_member
on public.categories
for insert
to authenticated
with check (
  public.is_family_member(family_id)
);

create policy categories_update_member
on public.categories
for update
to authenticated
using (
  public.is_family_member(family_id)
)
with check (
  public.is_family_member(family_id)
);

grant select, insert, update on public.categories to authenticated;

-- =================================================
-- FAMILIES RLS
-- =================================================
alter table public.families enable row level security;

drop policy if exists families_select_member on public.families;
drop policy if exists families_update_owner on public.families;

create policy families_select_member
on public.families
for select
to authenticated
using (
  public.is_family_member(id)
);

create policy families_update_owner
on public.families
for update
to authenticated
using (
  created_by = auth.uid()
)
with check (
  created_by = auth.uid()
);

grant select, update on public.families to authenticated;

commit;
