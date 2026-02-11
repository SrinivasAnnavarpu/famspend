# FamSpend Checklist

## Security / Hardening
- [ ] Enforce owner-only rules at DB level (RLS / policies)
  - [ ] Only owner can update `families` (name/base_currency)
  - [ ] Only owner can create invites (`family_invites` insert / create_invite RPC)
  - [ ] Members can only update their own `profiles.display_name` (block default_currency/timezone updates)

## UX
- [ ] TBD
