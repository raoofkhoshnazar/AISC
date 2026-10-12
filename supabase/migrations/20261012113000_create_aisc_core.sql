create type public.aisc_role as enum (
  'student',
  'supporter',
  'executive_manager',
  'project_manager'
);

create type public.aisc_access as enum (
  'trial',
  'paid',
  'complimentary',
  'suspended'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.aisc_role not null default 'student',
  access public.aisc_access not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  age_range text,
  grade text,
  weekly_time text,
  skills text,
  interests text,
  paid_experience text,
  audience text,
  goal text,
  idea text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supporter_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.profiles(id) on delete cascade,
  supporter_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  check (student_id <> supporter_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger student_profiles_set_updated_at
before update on public.student_profiles
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger create_profile_after_auth_user
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create or replace function public.current_aisc_role()
returns public.aisc_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_aisc_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_aisc_role() in ('executive_manager', 'project_manager');
$$;

create or replace function public.is_assigned_supporter(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.supporter_assignments
    where student_id = target_student_id
      and supporter_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.supporter_assignments enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "Managers can read every profile"
on public.profiles for select
to authenticated
using (public.is_aisc_manager());

create policy "Supporters can read assigned students"
on public.profiles for select
to authenticated
using (public.is_assigned_supporter(id));

create policy "Students can read their own onboarding profile"
on public.student_profiles for select
to authenticated
using (user_id = auth.uid());

create policy "Students can create their own onboarding profile"
on public.student_profiles for insert
to authenticated
with check (user_id = auth.uid());

create policy "Students can update their own onboarding profile"
on public.student_profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Managers can manage student onboarding profiles"
on public.student_profiles for all
to authenticated
using (public.is_aisc_manager())
with check (public.is_aisc_manager());

create policy "Supporters can read assigned student onboarding profiles"
on public.student_profiles for select
to authenticated
using (public.is_assigned_supporter(user_id));

create policy "Managers can manage supporter assignments"
on public.supporter_assignments for all
to authenticated
using (public.is_aisc_manager())
with check (public.is_aisc_manager());

create policy "Supporters can read their own assignments"
on public.supporter_assignments for select
to authenticated
using (supporter_id = auth.uid());
