-- HOOSE Official LINE OA bot · stage 1.5
-- Application form fields (filled through the LIFF form) and the list of HOOSE admins
-- who may open /admin/line. Both stay server only (RLS on, no policies).

alter table public.line_users
  add column full_name          text not null default '',
  add column phone              text not null default '',
  add column email              text not null default '',
  add column note               text not null default '',   -- admin's private note
  add column consent_at         timestamptz,                -- PDPA consent from the form
  add column applied_at         timestamptz,
  add column status_changed_at  timestamptz;

create table public.hoose_admins (
  user_id   uuid primary key references public.profiles(id) on delete cascade,
  added_at  timestamptz not null default now()
);
comment on table public.hoose_admins is 'App accounts that may open /admin/line (LINE applicants and chats). Add people by hand. Server only.';
alter table public.hoose_admins enable row level security;

-- First admin (chosen by hand)
insert into public.hoose_admins (user_id)
select id from public.profiles where lower(email) = 'zhoujirapat@gmail.com'
on conflict do nothing;
