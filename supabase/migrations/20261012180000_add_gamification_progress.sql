create table public.gamification_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  current_streak integer not null default 0 check (current_streak >= 0),
  last_activity_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid unique references public.submissions(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

insert into public.gamification_profiles (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create trigger gamification_profiles_set_updated_at
before update on public.gamification_profiles
for each row execute function public.set_updated_at();

create or replace function public.create_gamification_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.gamification_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger create_gamification_profile_after_profile
  after insert on public.profiles
  for each row execute procedure public.create_gamification_profile_for_new_user();

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
  end if;
  return new;
end;
$$;

create trigger award_xp_after_submission_approval
  after update of status on public.submissions
  for each row execute function public.award_xp_for_approved_submission();

alter table public.gamification_profiles enable row level security;
alter table public.xp_events enable row level security;

create policy "Users can read their own gamification profile"
on public.gamification_profiles for select
to authenticated
using (user_id = auth.uid());

create policy "Managers can read gamification profiles"
on public.gamification_profiles for select
to authenticated
using (public.is_aisc_manager());

create policy "Users can read their own XP events"
on public.xp_events for select
to authenticated
using (user_id = auth.uid());

create policy "Managers can read XP events"
on public.xp_events for select
to authenticated
using (public.is_aisc_manager());
