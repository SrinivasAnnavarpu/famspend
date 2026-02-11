-- Add icon + color to categories and update default seed list

alter table public.categories
  add column if not exists icon text,
  add column if not exists color text;

-- Optional: constrain sizes
alter table public.categories
  drop constraint if exists categories_icon_len_chk,
  add constraint categories_icon_len_chk check (icon is null or char_length(icon) <= 20);

alter table public.categories
  drop constraint if exists categories_color_len_chk,
  add constraint categories_color_len_chk check (color is null or char_length(color) <= 20);

-- NOTE: To update the create_family RPC, apply the updated SQL from supabase/create_family_rpc.sql
