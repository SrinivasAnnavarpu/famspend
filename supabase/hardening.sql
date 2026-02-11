-- Server-side validation/sanitation hardening
-- Apply in Supabase SQL editor.

-- 1) Helpers
create or replace function public.sanitize_plain_text(p_text text)
returns text
language sql
immutable
as $$
  select
    -- strip basic HTML tags
    regexp_replace(
      -- strip control chars except common whitespace
      regexp_replace(coalesce(p_text, ''), '[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]', '', 'g'),
      '<[^>]*>',
      '',
      'g'
    );
$$;

-- 2) EXPENSES: clamp + sanitize notes; basic checks
create or replace function public.expenses_before_write()
returns trigger
language plpgsql
as $$
begin
  if new.notes is not null then
    new.notes := left(public.sanitize_plain_text(new.notes), 280);
    if btrim(new.notes) = '' then
      new.notes := null;
    end if;
  end if;

  if new.amount_original_minor is not null and new.amount_original_minor <= 0 then
    raise exception 'amount must be > 0';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_expenses_before_write on public.expenses;
create trigger trg_expenses_before_write
before insert or update on public.expenses
for each row execute function public.expenses_before_write();

alter table public.expenses
  drop constraint if exists expenses_notes_len_chk,
  add constraint expenses_notes_len_chk check (notes is null or char_length(notes) <= 280);

alter table public.expenses
  drop constraint if exists expenses_amount_positive_chk,
  add constraint expenses_amount_positive_chk check (amount_original_minor is null or amount_original_minor > 0);

-- 3) PROFILES: sanitize + clamp display_name/timezone; basic checks
create or replace function public.profiles_before_write()
returns trigger
language plpgsql
as $$
begin
  if new.display_name is not null then
    new.display_name := left(public.sanitize_plain_text(new.display_name), 40);
    if btrim(new.display_name) = '' then
      new.display_name := null;
    end if;
  end if;

  if new.timezone is not null then
    new.timezone := left(public.sanitize_plain_text(new.timezone), 64);
    if btrim(new.timezone) = '' then
      new.timezone := 'UTC';
    end if;
  end if;

  if new.default_currency is not null then
    new.default_currency := upper(left(public.sanitize_plain_text(new.default_currency), 3));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_before_write on public.profiles;
create trigger trg_profiles_before_write
before insert or update on public.profiles
for each row execute function public.profiles_before_write();

alter table public.profiles
  drop constraint if exists profiles_display_name_len_chk,
  add constraint profiles_display_name_len_chk check (display_name is null or char_length(display_name) <= 40);

alter table public.profiles
  drop constraint if exists profiles_timezone_len_chk,
  add constraint profiles_timezone_len_chk check (timezone is null or char_length(timezone) <= 64);

alter table public.profiles
  drop constraint if exists profiles_default_currency_len_chk,
  add constraint profiles_default_currency_len_chk check (default_currency is null or char_length(default_currency) = 3);

-- 4) FAMILIES: basic checks
alter table public.families
  drop constraint if exists families_name_len_chk,
  add constraint families_name_len_chk check (name is null or char_length(name) <= 60);

alter table public.families
  drop constraint if exists families_base_currency_len_chk,
  add constraint families_base_currency_len_chk check (base_currency is null or char_length(base_currency) = 3);
