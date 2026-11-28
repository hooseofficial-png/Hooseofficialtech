-- Recruiting pipeline after the portfolio is approved:
--   applied → interview (Calendly link) → onboarding (documents + data form sent, waiting for "เสร็จสิ้น")
--   → approved (asked to create a HOOSE account) → active (account linked)
-- plus PDF documents the team sends on LINE (stored privately; LINE gets time-limited links).

alter table public.line_users drop constraint if exists line_users_status_check;
alter table public.line_users add constraint line_users_status_check
  check (status in ('new', 'applying', 'applied', 'interview', 'onboarding', 'approved', 'rejected', 'active', 'blocked'));

create table public.line_documents (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  path       text not null,                 -- storage object in bucket line-docs
  audience   text not null default 'all' check (audience in ('all', 'editor', 'crew')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.line_documents enable row level security;

insert into storage.buckets (id, name, public) values ('line-docs', 'line-docs', false)
on conflict (id) do nothing;
