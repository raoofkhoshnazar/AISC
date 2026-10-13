create or replace function public.get_aisc_manager_analytics()
returns table (
  student_count bigint,
  onboarding_completed bigint,
  supporter_review_pending bigint,
  manager_review_pending bigint,
  approved_submissions bigint,
  active_supporters bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_aisc_manager() then
    raise exception 'Only managers can view analytics';
  end if;

  return query
  select
    (select count(*) from public.profiles where role = 'student'),
    (select count(*)
     from public.student_profiles sp
     join public.profiles p on p.id = sp.user_id
     where p.role = 'student' and sp.onboarding_completed),
    (select count(*) from public.submissions where status = 'submitted'),
    (select count(*) from public.submissions where status = 'supporter_approved'),
    (select count(*) from public.submissions where status = 'manager_approved'),
    (select count(distinct sa.supporter_id) from public.supporter_assignments sa);
end;
$$;

revoke all on function public.get_aisc_manager_analytics() from public;
grant execute on function public.get_aisc_manager_analytics() to authenticated;
