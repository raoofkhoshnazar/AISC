create or replace function public.set_student_access(
  target_student_id uuid,
  new_access public.aisc_access
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_aisc_role() <> 'project_manager' then
    raise exception 'Only project managers can update student access';
  end if;

  update public.profiles
  set access = new_access
  where id = target_student_id
    and role = 'student';

  if not found then
    raise exception 'Student not found';
  end if;
end;
$$;

create or replace function public.assign_supporter_to_student(
  target_student_id uuid,
  target_supporter_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_aisc_role() <> 'project_manager' then
    raise exception 'Only project managers can assign supporters';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = target_student_id and role = 'student'
  ) then
    raise exception 'Student not found';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = target_supporter_id and role = 'supporter'
  ) then
    raise exception 'Supporter not found';
  end if;

  insert into public.supporter_assignments (student_id, supporter_id)
  values (target_student_id, target_supporter_id)
  on conflict (student_id) do update
  set supporter_id = excluded.supporter_id,
      assigned_at = now();
end;
$$;

create or replace function public.unassign_supporter_from_student(
  target_student_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_aisc_role() <> 'project_manager' then
    raise exception 'Only project managers can unassign supporters';
  end if;

  delete from public.supporter_assignments
  where student_id = target_student_id;
end;
$$;

revoke all on function public.set_student_access(uuid, public.aisc_access) from public;
revoke all on function public.assign_supporter_to_student(uuid, uuid) from public;
revoke all on function public.unassign_supporter_from_student(uuid) from public;
grant execute on function public.set_student_access(uuid, public.aisc_access) to authenticated;
grant execute on function public.assign_supporter_to_student(uuid, uuid) to authenticated;
grant execute on function public.unassign_supporter_from_student(uuid) to authenticated;
