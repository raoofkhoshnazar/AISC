create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  icon text not null,
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

insert into public.badges (slug, title, description, icon)
values
  ('first_approval', 'اولین قدم', 'اولین تکلیف تو تأیید نهایی شد.', '🚀'),
  ('xp_100', 'صد XP', 'به ۱۰۰ XP رسیدی.', '⚡'),
  ('level_3', 'سازندهٔ پیگیر', 'به سطح ۳ رسیدی.', '🏆')
on conflict (slug) do nothing;

create or replace function public.evaluate_student_badges(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_xp integer;
  current_level integer;
begin
  select xp, level into current_xp, current_level
  from public.gamification_profiles
  where user_id = target_user_id;

  insert into public.user_badges (user_id, badge_id)
  select target_user_id, b.id
  from public.badges b
  where (
    b.slug = 'first_approval' and exists (
      select 1 from public.xp_events where user_id = target_user_id
    )
  ) or (
    b.slug = 'xp_100' and current_xp >= 100
  ) or (
    b.slug = 'level_3' and current_level >= 3
  )
  on conflict (user_id, badge_id) do nothing;
end;
$$;

create or replace function public.award_xp_for_approved_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reward integer;
  inserted_rows integer;
begin
  if new.status = 'manager_approved' and old.status is distinct from 'manager_approved' then
    select xp_reward into reward
    from public.assignments
    where id = new.assignment_id;

    if coalesce(reward, 0) > 0 then
      insert into public.xp_events (user_id, submission_id, amount)
      values (new.student_id, new.id, reward)
      on conflict (submission_id) do nothing;

      get diagnostics inserted_rows = row_count;
      if inserted_rows > 0 then
        update public.gamification_profiles
        set xp = xp + reward,
            level = greatest(1, floor((xp + reward) / 100.0)::integer + 1),
            current_streak = case
              when last_activity_date = current_date then current_streak
              when last_activity_date = current_date - 1 then current_streak + 1
              else 1
            end,
            last_activity_date = current_date
        where user_id = new.student_id;
      end if;
    end if;

    perform public.evaluate_student_badges(new.student_id);
  end if;
  return new;
end;
$$;

create or replace function public.get_aisc_leaderboard()
returns table (
  display_name text,
  xp integer,
  level integer,
  rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    nullif(trim(p.full_name), '') as display_name,
    g.xp,
    g.level,
    rank() over (order by g.xp desc, p.created_at asc) as rank
  from public.gamification_profiles g
  join public.profiles p on p.id = g.user_id
  where p.role = 'student'
  order by g.xp desc, p.created_at asc
  limit 50;
$$;

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

create policy "Authenticated users can read badges"
on public.badges for select
to authenticated
using (true);

create policy "Users can read their own badges"
on public.user_badges for select
to authenticated
using (user_id = auth.uid());

create policy "Managers can read earned badges"
on public.user_badges for select
to authenticated
using (public.is_aisc_manager());

revoke all on function public.get_aisc_leaderboard() from public;
grant execute on function public.get_aisc_leaderboard() to authenticated;
