create or replace function public.update_my_full_name(new_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(trim(new_full_name)) < 2 then
    raise exception 'Full name must contain at least two characters';
  end if;

  update public.profiles
  set full_name = trim(new_full_name)
  where id = auth.uid();
end;
$$;

grant execute on function public.update_my_full_name(text) to authenticated;
