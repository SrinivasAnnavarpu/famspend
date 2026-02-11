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

  insert into public.categories (family_id, name, sort_order, icon, color)
  values
    (v_family_id, 'Auto & Transport', 0, '🚗', '#BAE6FD'),
    (v_family_id, 'Bills & Utilities', 1, '🧾', '#C7D2FE'),
    (v_family_id, 'Business', 2, '🏢', '#BBF7D0'),
    (v_family_id, 'Cash & Checks', 3, '💵', '#A7F3D0'),
    (v_family_id, 'Charitable Donations', 4, '🤝', '#D9F99D'),
    (v_family_id, 'Dining & Drinks', 5, '🍽️', '#DDD6FE'),
    (v_family_id, 'Education', 6, '🎓', '#FED7AA'),
    (v_family_id, 'Entertainment & Rec.', 7, '🎭', '#FED7AA'),
    (v_family_id, 'Family Care', 8, '❤️', '#FBCFE8'),
    (v_family_id, 'Fees', 9, '💸', '#FECACA'),
    (v_family_id, 'Furniture', 10, '🛋️', '#C7D2FE'),
    (v_family_id, 'Gifts', 11, '🎁', '#DDD6FE'),
    (v_family_id, 'Groceries', 12, '🛒', '#FBCFE8'),
    (v_family_id, 'Health & Wellness', 13, '🫶', '#BAE6FD'),
    (v_family_id, 'Home & Garden', 14, '🏠', '#BBF7D0'),
    (v_family_id, 'Legal', 15, '⚖️', '#FECACA'),
    (v_family_id, 'Loan Payment', 16, '💳', '#BFDBFE'),
    (v_family_id, 'Medical', 17, '🩺', '#BFDBFE'),
    (v_family_id, 'Personal Care', 18, '🌸', '#FBCFE8'),
    (v_family_id, 'Pets', 19, '🐾', '#A5F3FC'),
    (v_family_id, 'Rent', 20, '🏠', '#C7D2FE'),
    (v_family_id, 'Shopping', 21, '🛍️', '#FDE68A'),
    (v_family_id, 'Software & Tech', 22, '☁️', '#BFDBFE'),
    (v_family_id, 'Taxes', 23, '🧾', '#BFDBFE'),
    (v_family_id, 'Travel & Vacation', 24, '✈️', '#FECACA')
  on conflict do nothing;

  return v_family_id;
end;
$func$;

grant execute on function public.create_family(text) to authenticated;
