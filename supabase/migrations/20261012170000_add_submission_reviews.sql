create or replace function public.review_submission_as_supporter(
  target_submission_id uuid,
  new_score smallint,
  new_feedback text,
  is_approved boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_student_id uuid;
  current_status public.aisc_submission_status;
begin
  if public.current_aisc_role() <> 'supporter' then
    raise exception 'Only supporters can review submissions';
  end if;

  if new_score not between 1 and 5 then
    raise exception 'Score must be between 1 and 5';
  end if;

  select student_id, status into target_student_id, current_status
  from public.submissions
  where id = target_submission_id;

  if not found or not public.is_assigned_supporter(target_student_id) then
    raise exception 'Submission not found';
  end if;

  if current_status <> 'submitted' then
    raise exception 'Submission is not ready for supporter review';
  end if;

  update public.submissions
  set supporter_score = new_score,
      supporter_feedback = trim(new_feedback),
      status = case when is_approved then 'supporter_approved' else 'supporter_revision_requested' end
  where id = target_submission_id;
end;
$$;

create or replace function public.review_submission_as_manager(
  target_submission_id uuid,
  new_score smallint,
  new_feedback text,
  is_approved boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status public.aisc_submission_status;
begin
  if public.current_aisc_role() <> 'project_manager' then
    raise exception 'Only project managers can review submissions';
  end if;

  if new_score not between 1 and 5 then
    raise exception 'Score must be between 1 and 5';
  end if;

  select status into current_status
  from public.submissions
  where id = target_submission_id;

  if not found then
    raise exception 'Submission not found';
  end if;

  if current_status <> 'supporter_approved' then
    raise exception 'Submission is not ready for manager review';
  end if;

  update public.submissions
  set manager_score = new_score,
      manager_feedback = trim(new_feedback),
      status = case when is_approved then 'manager_approved' else 'manager_revision_requested' end
  where id = target_submission_id;
end;
$$;

revoke all on function public.review_submission_as_supporter(uuid, smallint, text, boolean) from public;
revoke all on function public.review_submission_as_manager(uuid, smallint, text, boolean) from public;
grant execute on function public.review_submission_as_supporter(uuid, smallint, text, boolean) to authenticated;
grant execute on function public.review_submission_as_manager(uuid, smallint, text, boolean) to authenticated;
