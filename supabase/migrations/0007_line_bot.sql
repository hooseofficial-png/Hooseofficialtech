-- HOOSE Official LINE OA bot · stage 1
-- People who added the OA, their chat memory, and their answers to Open Calls.
-- Server only: every table has RLS on and no policies, so only the service-role key
-- (used by /api/line/webhook) can read or write them.

create table public.line_users (
  line_user_id   text primary key,
  display_name   text not null default '',
  picture_url    text not null default '',
  -- editor = freelance editor · crew = HOOSE production crew · manager = PM / Producer using the app
  role           text check (role in ('editor', 'crew', 'manager')),
  -- recruiting funnel
  status         text not null default 'new'
                 check (status in ('new', 'applying', 'applied', 'interview', 'approved', 'rejected', 'active', 'blocked')),
  position       text not null default '',
  portfolio_url  text not null default '',
  profile_id     uuid references public.profiles(id) on delete set null,
  following      boolean not null default true,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);
comment on table public.line_users is 'Everyone who added HOOSE Official on LINE: role, recruiting status and link to an app account. Server only.';

create table public.line_messages (
  id            bigint generated always as identity primary key,
  line_user_id  text not null references public.line_users(line_user_id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  created_at    timestamptz not null default now()
);
create index line_messages_user_time on public.line_messages (line_user_id, created_at desc);
comment on table public.line_messages is 'Short-term chat memory for the LINE AI assistant (last turns per person). Server only.';

create table public.open_call_responses (
  id               uuid primary key default gen_random_uuid(),
  announcement_id  uuid references public.announcements(id) on delete set null,
  position_id      uuid not null references public.crew_positions(id) on delete cascade,
  line_user_id     text not null references public.line_users(line_user_id) on delete cascade,
  answer           text not null check (answer in ('accept', 'decline')),
  created_at       timestamptz not null default now(),
  unique (position_id, line_user_id)
);
comment on table public.open_call_responses is 'Accept / decline taps on Open Call cards sent through LINE. Server only.';

alter table public.line_users          enable row level security;
alter table public.line_messages       enable row level security;
alter table public.open_call_responses enable row level security;
