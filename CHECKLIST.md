# FamSpend Checklist

## Security / Hardening
- [ ] Apply Supabase RLS hardening SQL: `supabase/rls.sql`
  - [x] Expenses: members can read + create; update/delete only own; owner can update/delete any
  - [ ] Categories: members can read + create + edit (needed for "+ New" category)
  - [ ] Families: members can read; owner can update
- [ ] Apply invites policies/RPC SQL: `supabase/invites.sql` (owner-only create/select)
- [ ] Profiles update restrictions at DB level
  - [ ] Members can only update their own `profiles.display_name` (and optionally timezone/default_currency)
  - [ ] Consider trigger-based column allowlist enforcement (Postgres RLS isn’t column-granular)

## UX
- [ ] TBD
