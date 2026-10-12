create type public.aisc_submission_status as enum (
  'draft',
  'submitted',
  'supporter_revision_requested',
  'supporter_approved',
  'manager_revision_requested',
  'manager_approved'
);

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  learning_path_id uuid not null references public.learning_paths(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  description text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learning_path_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  content text not null default '',
  resource_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, position)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  instructions text not null default '',
  rubric text not null default '',
  xp_reward integer not null default 0 check (xp_reward >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  response_text text not null default '',
  resource_url text,
  status public.aisc_submission_status not null default 'draft',
  supporter_feedback text,
  supporter_score smallint check (supporter_score between 1 and 5),
  manager_feedback text,
  manager_score smallint check (manager_score between 1 and 5),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create trigger learning_paths_set_updated_at
before update on public.learning_paths
for each row execute function public.set_updated_at();

create trigger modules_set_updated_at
before update on public.modules
for each row execute function public.set_updated_at();

create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

create trigger assignments_set_updated_at
before update on public.assignments
for each row execute function public.set_updated_at();

create trigger submissions_set_updated_at
before update on public.submissions
for each row execute function public.set_updated_at();

create or replace function public.is_assigned_student_submission(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_assigned_supporter(target_student_id);
$$;

alter table public.learning_paths enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

create policy "Authenticated users can read published learning paths"
on public.learning_paths for select
to authenticated
using (is_published or public.is_aisc_manager());

create policy "Managers can manage learning paths"
on public.learning_paths for all
to authenticated
using (public.is_aisc_manager())
with check (public.is_aisc_manager());

create policy "Authenticated users can read published modules"
on public.modules for select
to authenticated
using (is_published or public.is_aisc_manager());

create policy "Managers can manage modules"
on public.modules for all
to authenticated
using (public.is_aisc_manager())
with check (public.is_aisc_manager());

create policy "Authenticated users can read published lessons"
on public.lessons for select
to authenticated
using (is_published or public.is_aisc_manager());

create policy "Managers can manage lessons"
on public.lessons for all
to authenticated
using (public.is_aisc_manager())
with check (public.is_aisc_manager());

create policy "Authenticated users can read published assignments"
on public.assignments for select
to authenticated
using (is_published or public.is_aisc_manager());

create policy "Managers can manage assignments"
on public.assignments for all
to authenticated
using (public.is_aisc_manager())
with check (public.is_aisc_manager());

create policy "Students can read their own submissions"
on public.submissions for select
to authenticated
using (student_id = auth.uid());

create policy "Students can create their own submissions"
on public.submissions for insert
to authenticated
with check (student_id = auth.uid());

create policy "Students can update editable submissions"
on public.submissions for update
to authenticated
using (
  student_id = auth.uid()
  and status in ('draft', 'supporter_revision_requested', 'manager_revision_requested')
)
with check (student_id = auth.uid());

create policy "Assigned supporters can read student submissions"
on public.submissions for select
to authenticated
using (public.is_assigned_student_submission(student_id));

create policy "Managers can manage submissions"
on public.submissions for all
to authenticated
using (public.is_aisc_manager())
with check (public.is_aisc_manager());
