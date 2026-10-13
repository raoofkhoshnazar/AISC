create or replace function public.notify_student_submission_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_title text;
  notification_title text;
  notification_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status not in ('submitted', 'supporter_revision_requested', 'supporter_approved', 'manager_revision_requested', 'manager_approved') then
    return new;
  end if;

  select title into assignment_title
  from public.assignments
  where id = new.assignment_id;

  if new.status = 'submitted' then
    insert into public.notifications (user_id, submission_id, type, title, body)
    select
      sa.supporter_id,
      new.id,
      'submission_status',
      'تکلیف جدید برای بررسی',
      coalesce(assignment_title, 'تکلیف دانش‌آموز') || ' برای بررسی تو ارسال شده است.'
    from public.supporter_assignments sa
    where sa.student_id = new.student_id;
    return new;
  end if;

  if new.status = 'supporter_approved' then
    insert into public.notifications (user_id, submission_id, type, title, body)
    select
      p.id,
      new.id,
      'submission_status',
      'تکلیف جدید برای تأیید نهایی',
      coalesce(assignment_title, 'تکلیف دانش‌آموز') || ' پس از تأیید پشتیبان آمادهٔ بررسی توست.'
    from public.profiles p
    where p.role = 'project_manager';
    return new;
  end if;

  notification_title := case new.status
    when 'supporter_revision_requested' then 'تکلیف تو نیاز به اصلاح دارد'
    when 'manager_revision_requested' then 'مدیر پروژه برای تکلیف بازخورد داده است'
    when 'manager_approved' then 'تکلیف تو تأیید نهایی شد'
  end;

  notification_body := case new.status
    when 'supporter_revision_requested' then 'بازخورد پشتیبان را بخوان و نسخهٔ بهتر کارت را دوباره ارسال کن.'
    when 'manager_revision_requested' then 'بازخورد مدیر پروژه را بخوان و اصلاحات خواسته‌شده را انجام بده.'
    when 'manager_approved' then 'آفرین! این تکلیف نهایی شد و پاداش آن برایت ثبت می‌شود.'
  end;

  insert into public.notifications (user_id, submission_id, type, title, body)
  values (
    new.student_id,
    new.id,
    'submission_status',
    notification_title,
    coalesce(assignment_title, 'تکلیف تو') || ' · ' || notification_body
  );

  return new;
end;
$$;
