-- Editing by project (ClickUp parent task), re-announcing overdue projects, and server-side settings
-- (the ClickUp webhook id + secret). Server only: RLS on, no policies.

alter table public.editing_calls
  add column reason text not null default 'new' check (reason in ('new', 'reassign')),
  add column exclude_line_user_id text,
  add column clips integer not null default 0;

create table public.app_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
