create type public.aisc_room_type as enum ('class', 'supporter_group', 'direct', 'announcements');

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  room_type public.aisc_room_type not null,
  name text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create or replace function public.is_chat_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_room_members
    where room_id = target_room_id and user_id = auth.uid()
  );
$$;

create or replace function public.shares_chat_room(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_room_members mine
    join public.chat_room_members peer on peer.room_id = mine.room_id
    where mine.user_id = auth.uid()
      and peer.user_id = target_user_id
  );
$$;

create policy "Chat members can read peer profiles"
on public.profiles for select to authenticated
using (public.shares_chat_room(id));

alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;

create policy "Members can read their chat rooms"
on public.chat_rooms for select to authenticated
using (public.is_chat_room_member(id) or public.is_aisc_manager());

create policy "Managers can manage chat rooms"
on public.chat_rooms for all to authenticated
using (public.is_aisc_manager()) with check (public.is_aisc_manager());

create policy "Members can read room memberships"
on public.chat_room_members for select to authenticated
using (public.is_chat_room_member(room_id) or public.is_aisc_manager());

create policy "Managers can manage room memberships"
on public.chat_room_members for all to authenticated
using (public.is_aisc_manager()) with check (public.is_aisc_manager());

create policy "Members can read messages"
on public.chat_messages for select to authenticated
using (public.is_chat_room_member(room_id) or public.is_aisc_manager());

create policy "Members can send messages"
on public.chat_messages for insert to authenticated
with check (sender_id = auth.uid() and public.is_chat_room_member(room_id));

create policy "Managers can manage messages"
on public.chat_messages for all to authenticated
using (public.is_aisc_manager()) with check (public.is_aisc_manager());
