drop policy "Students can create their own submissions" on public.submissions;
drop policy "Students can update editable submissions" on public.submissions;

create or replace function public.submit_my_assignment(
  target_assignment_id uuid,
  new_response_text text,
  new_resource_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_status public.aisc_submission_status;
begin
  if public.current_aisc_role() <> 'student' then
    raise exception 'Only students can submit assignments';
  end if;

  if not exists (
    select 1
    from public.assignments a
    join public.modules m on m.id = a.module_id
    join public.learning_paths p on p.id = m.learning_path_id
    where a.id = target_assignment_id
      and a.is_published
      and m.is_published
      and p.is_published
  ) then
    raise exception 'Assignment is not available';
  end if;

  select status into existing_status
  from public.submissions
  where assignment_id = target_assignment_id
    and student_id = auth.uid();

  if found and existing_status not in ('draft', 'supporter_revision_requested', 'manager_revision_requested') then
    raise exception 'Submission is not editable';
  end if;

  insert into public.submissions (
    assignment_id,
    student_id,
    response_text,
    resource_url,
    status,
    submitted_at
  )
  values (
    target_assignment_id,
    auth.uid(),
    trim(new_response_text),
    nullif(trim(new_resource_url), ''),
    'submitted',
    now()
  )
  on conflict (assignment_id, student_id) do update
  set response_text = excluded.response_text,
      resource_url = excluded.resource_url,
      status = 'submitted',
      submitted_at = now();
end;
$$;

revoke all on function public.submit_my_assignment(uuid, text, text) from public;
grant execute on function public.submit_my_assignment(uuid, text, text) to authenticated;
