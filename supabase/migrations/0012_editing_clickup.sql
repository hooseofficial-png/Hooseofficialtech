-- Editing work from ClickUp: link LINE editors to ClickUp members, job calls sent on LINE, reminder log.
-- Server only: RLS on, no policies (service-role key from the app server).

alter table public.line_users add column clickup_user_id bigint;

create table public.editing_calls (
  id                    uuid primary key default gen_random_uuid(),
  clickup_task_id       text not null,
  task_name             text not null default '',
  parent_name           text not null default '',
  due_date              timestamptz,
  detail                text not null default '',
  rate                  text not null default '',
  status                text not null default 'open' check (status in ('open', 'assigned', 'cancelled')),
  sent_to               integer not null default 0,
  assigned_line_user_id text references public.line_users(line_user_id) on delete set null,
  assigned_at           timestamptz,
  clickup_assigned      boolean not null default false,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now()
);
create index editing_calls_task_idx on public.editing_calls (clickup_task_id);
alter table public.editing_calls enable row level security;

create table public.line_reminders (
  id              bigint generated always as identity primary key,
  line_user_id    text not null references public.line_users(line_user_id) on delete cascade,
  clickup_task_id text not null,
  kind            text not null check (kind in ('not_started', 'due_soon', 'overdue', 'done')),
  sent_at         timestamptz not null default now(),
  unique (line_user_id, clickup_task_id, kind)
);
alter table public.line_reminders enable row level security;
