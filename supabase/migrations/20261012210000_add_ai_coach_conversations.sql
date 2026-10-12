create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(trim(content)) between 1 and 10000),
  created_at timestamptz not null default now()
);

create trigger ai_conversations_set_updated_at
before update on public.ai_conversations
for each row execute function public.set_updated_at();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy "Users can manage their AI conversations"
on public.ai_conversations for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can read their AI messages"
on public.ai_messages for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create their AI messages"
on public.ai_messages for insert
to authenticated
with check (user_id = auth.uid());
