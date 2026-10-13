create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  type text not null check (type in ('submission_status')),
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_at_idx
on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can read their notifications"
on public.notifications for select
to authenticated
using (user_id = auth.uid());

create or replace function public.mark_my_notifications_read(notification_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = coalesce(read_at, now())
  where user_id = auth.uid()
    and id = any(notification_ids);
$$;

revoke all on function public.mark_my_notifications_read(uuid[]) from public;
grant execute on function public.mark_my_notifications_read(uuid[]) to authenticated;

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

  if new.status not in ('supporter_revision_requested', 'supporter_approved', 'manager_revision_requested', 'manager_approved') then
    return new;
  end if;

  select title into assignment_title
  from public.assignments
  where id = new.assignment_id;

  notification_title := case new.status
    when 'supporter_revision_requested' then 'تکلیف تو نیاز به اصلاح دارد'
    when 'supporter_approved' then 'تکلیف تو به مدیر پروژه رسید'
    when 'manager_revision_requested' then 'مدیر پروژه برای تکلیف بازخورد داده است'
    when 'manager_approved' then 'تکلیف تو تأیید نهایی شد'
  end;

  notification_body := case new.status
    when 'supporter_revision_requested' then 'بازخورد پشتیبان را بخوان و نسخهٔ بهتر کارت را دوباره ارسال کن.'
    when 'supporter_approved' then 'پشتیبان کارت را تأیید کرده است؛ بررسی نهایی در انتظار مدیر پروژه است.'
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

create trigger notify_student_submission_status_after_update
after update of status on public.submissions
for each row execute function public.notify_student_submission_status();
