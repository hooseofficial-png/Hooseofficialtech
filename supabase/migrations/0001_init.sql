-- =====================================================================
-- HOOSE · Production Management Platform
-- Database schema v1 (Supabase / Postgres 15+)
-- Run once in Supabase → SQL Editor (or `supabase db push`).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type public.member_role     as enum ('owner', 'editor', 'viewer');
create type public.crew_status     as enum ('confirmed', 'pending', 'open');
create type public.rate_type       as enum ('day', 'flat');
create type public.event_type      as enum ('shoot', 'brief', 'meeting');
create type public.announce_status as enum ('queued', 'sending', 'sent', 'failed');

-- ---------- people ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null default '',
  full_name   text not null default '',
  phone       text not null default '',
  line_id     text not null default '',
  created_at  timestamptz not null default now()
);
comment on table public.profiles is 'One row per login (auth.users). Created automatically on sign-up.';

-- ---------- projects ----------
create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  name             text not null default '',
  brand            text not null default '',
  agency           text not null default '',
  company          text not null default '',
  director         text not null default '',
  producer         text not null default '',
  pm_name          text not null default '',
  pm_phone         text not null default '',
  deliverables     text not null default '',
  type             text not null default '',
  campaign         text not null default '',
  synopsis         text not null default '',
  start_date       date,
  end_date         date,
  queues           integer check (queues is null or queues >= 0),
  call_time        time,
  wrap_time        time,
  setting          text not null default '',
  time_of_day      text not null default '',
  special          text not null default '',
  locations        text[] not null default '{}',
  logo_path        text,
  line_group_link  text not null default '',
  details_locked   boolean not null default false,
  locked_at        timestamptz,
  locked_by        uuid references public.profiles (id) on delete set null,
  share_enabled    boolean not null default false,
  share_token      text not null unique default encode(gen_random_bytes(16), 'hex'),
  share_budget     boolean not null default false,
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.projects is 'One production. Details page fields, lock state and share-link settings.';

create table public.project_members (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.member_role not null default 'viewer',
  added_at    timestamptz not null default now(),
  primary key (project_id, user_id)
);
comment on table public.project_members is 'owner/editor = full project access · viewer = summary page only.';

create table public.project_invites (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  email       text not null check (email = lower(email)),
  role        public.member_role not null default 'viewer',
  invited_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (project_id, email)
);
comment on table public.project_invites is 'Invites for people who have not logged in yet. Turned into members on first login.';

-- ---------- crew ----------
create table public.crew_positions (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  dept             text not null default 'other',
  position         text not null,
  status           public.crew_status not null default 'open',
  name             text not null default '',
  phone            text not null default '',
  line_id          text not null default '',
  rate_type        public.rate_type not null default 'day',
  budget           numeric(14, 2) not null default 0 check (budget >= 0),
  days             numeric(6, 1) not null default 1 check (days >= 0),
  scope            text not null default '',
  scope_file_path  text,
  scope_file_name  text not null default '',
  scope_url        text not null default '',
  sort             integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.crew_positions (project_id, dept, sort);

-- ---------- calendar ----------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  kind        text not null default '',          -- Kick-Off Meeting, Client Meeting, Shoot Day …
  type        public.event_type not null default 'meeting',
  date        date,                              -- null = ยังไม่ระบุวัน (TBD)
  time        time,
  title       text not null default '',
  created_at  timestamptz not null default now()
);
create index on public.events (project_id, date);

-- ---------- documents ----------
create table public.doc_categories (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index on public.doc_categories (project_id, sort);

create table public.doc_files (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.doc_categories (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  storage_path  text,
  url           text,
  name          text not null default '',
  size_bytes    bigint,
  uploaded_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  check (storage_path is not null or (url is not null and url ~* '^https://'))
);
create index on public.doc_files (category_id);

-- ---------- budget ----------
create table public.budgets (
  project_id        uuid primary key references public.projects (id) on delete cascade,
  total             numeric(14, 2) not null default 0 check (total >= 0),
  crew_alloc        numeric(14, 2) not null default 0 check (crew_alloc >= 0),  -- 0 = auto from crew board
  crew_alloc_draft  boolean not null default false,
  drafted           boolean not null default false,
  updated_at        timestamptz not null default now()
);

create table public.budget_lines (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  key         text,                 -- suggestion category (phs, equip, loc …) when auto-drafted
  name        text not null default '',
  amount      numeric(14, 2) not null default 0 check (amount >= 0),
  draft       boolean not null default false,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index on public.budget_lines (project_id, sort);

-- ---------- announcements (queue for HOOSE Official LINE OA) ----------
create table public.announcements (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  position_ids  uuid[] not null default '{}',
  message       text not null,
  status        public.announce_status not null default 'queued',
  error         text,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index on public.announcements (status, created_at);
comment on table public.announcements is 'Crew-call announcements. A server worker sends rows with status=queued through the Hooseofficial LINE Messaging API.';

-- =====================================================================
-- Helper functions (security definer: used inside RLS policies)
-- =====================================================================
create or replace function public.my_role(pid uuid)
returns public.member_role language sql stable security definer set search_path = public as $$
  select role from public.project_members where project_id = pid and user_id = auth.uid();
$$;

create or replace function public.is_member(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = pid and user_id = auth.uid());
$$;

create or replace function public.can_edit(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = pid and user_id = auth.uid() and role in ('owner', 'editor'));
$$;

create or replace function public.is_owner(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = pid and user_id = auth.uid() and role = 'owner');
$$;

-- =====================================================================
-- Triggers
-- =====================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
create trigger crew_touch     before update on public.crew_positions for each row execute function public.touch_updated_at();
create trigger budgets_touch  before update on public.budgets for each row execute function public.touch_updated_at();

-- New project: creator becomes owner, budget row + default document categories.
create or replace function public.on_project_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare t text; i int := 0;
begin
  if new.created_by is not null then
    insert into public.project_members (project_id, user_id, role) values (new.id, new.created_by, 'owner') on conflict do nothing;
  end if;
  insert into public.budgets (project_id) values (new.id) on conflict do nothing;
  foreach t in array array['สคริปต์', 'สตอรี่บอร์ด', 'เบรกดาวน์', 'ช็อตลิสต์', 'คอลชีท', 'รายการพร็อพ', 'ใบอนุญาตสถานที่', 'สัญญา'] loop
    insert into public.doc_categories (project_id, title, sort) values (new.id, t, i); i := i + 1;
  end loop;
  return new;
end $$;
create trigger projects_created after insert on public.projects for each row execute function public.on_project_created();

-- Locked details cannot change (only the lock itself / share settings may change).
create or replace function public.enforce_details_lock()
returns trigger language plpgsql as $$
begin
  if old.details_locked and new.details_locked and (
       (to_jsonb(new) - array['details_locked','locked_at','locked_by','share_enabled','share_token','share_budget','updated_at'])
    is distinct from
       (to_jsonb(old) - array['details_locked','locked_at','locked_by','share_enabled','share_token','share_budget','updated_at'])
  ) then
    raise exception 'รายละเอียดโปรเจกต์ถูกยืนยันและล็อกไว้ ปลดล็อกก่อนแก้ไข' using errcode = 'P0001';
  end if;
  if new.details_locked and not old.details_locked then
    new.locked_at := now(); new.locked_by := auth.uid();
  end if;
  return new;
end $$;
create trigger projects_lock before update on public.projects for each row execute function public.enforce_details_lock();

-- New login: create profile and accept pending invites.
create or replace function public.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(coalesce(new.email, '')), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  insert into public.project_members (project_id, user_id, role)
    select project_id, new.id, role from public.project_invites where email = lower(new.email)
  on conflict do nothing;
  delete from public.project_invites where email = lower(new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.on_auth_user_created();

-- =====================================================================
-- RPC
-- =====================================================================
-- Invite by email: adds member now if they have logged in before, else stores an invite.
create or replace function public.invite_member(pid uuid, invite_email text, invite_role public.member_role)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid; e text := lower(trim(invite_email));
begin
  if not public.can_edit(pid) then raise exception 'ไม่มีสิทธิ์เชิญสมาชิก'; end if;
  if invite_role = 'owner' and not public.is_owner(pid) then raise exception 'เฉพาะเจ้าของโปรเจกต์ที่ตั้ง owner ได้'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'อีเมลไม่ถูกต้อง'; end if;
  select id into uid from public.profiles where email = e;
  if uid is not null then
    insert into public.project_members (project_id, user_id, role) values (pid, uid, invite_role)
    on conflict (project_id, user_id) do update set role = excluded.role;
    return 'added';
  end if;
  insert into public.project_invites (project_id, email, role) values (pid, e, invite_role)
  on conflict (project_id, email) do update set role = excluded.role;
  return 'invited';
end $$;

-- Member list with names (profiles of other people are otherwise hidden).
create or replace function public.project_people(pid uuid)
returns table (user_id uuid, email text, full_name text, role public.member_role, pending boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.email, p.full_name, m.role, false from public.project_members m join public.profiles p on p.id = m.user_id
   where m.project_id = pid and public.is_member(pid)
  union all
  select null, i.email, '', i.role, true from public.project_invites i
   where i.project_id = pid and public.can_edit(pid)
  order by 5, 4, 2;
$$;

-- Summary JSON (the "สรุปผล" page). Money is included only for editors, or when share_budget is on.
create or replace function public.summary_json(pid uuid, with_money boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'project', to_jsonb(p) - 'share_token' - 'created_by' - 'locked_by',
    'crew', coalesce((select jsonb_agg(
              (case when with_money then to_jsonb(c) else to_jsonb(c) - 'budget' - 'days' - 'rate_type' end)
              order by c.dept, c.sort, c.created_at) from public.crew_positions c where c.project_id = p.id), '[]'),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.date nulls first, e.time) from public.events e where e.project_id = p.id), '[]'),
    'docs', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'files',
              coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'url', f.url, 'storage_path', f.storage_path) order by f.created_at)
                        from public.doc_files f where f.category_id = d.id), '[]')) order by d.sort) from public.doc_categories d where d.project_id = p.id), '[]'),
    'budget', case when with_money then (select to_jsonb(b) from public.budgets b where b.project_id = p.id) end,
    'budget_lines', case when with_money then coalesce((select jsonb_agg(to_jsonb(l) order by l.sort) from public.budget_lines l where l.project_id = p.id), '[]') end,
    'announcements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'status', a.status, 'created_at', a.created_at, 'positions', cardinality(a.position_ids)) order by a.created_at)
                       from public.announcements a where a.project_id = p.id), '[]'),
    'with_money', with_money
  ) from public.projects p where p.id = pid;
$$;

create or replace function public.project_summary(pid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pr public.projects;
begin
  if not public.is_member(pid) then return null; end if;
  select * into pr from public.projects where id = pid;
  return public.summary_json(pid, public.can_edit(pid) or pr.share_budget);
end $$;

-- Public share link (no login): works only while share_enabled is on.
create or replace function public.shared_summary(token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pr public.projects;
begin
  select * into pr from public.projects where share_token = token and share_enabled;
  if pr.id is null then return null; end if;
  return public.summary_json(pr.id, pr.share_budget);
end $$;

-- New share token (old links stop working).
create or replace function public.rotate_share_token(pid uuid)
returns text language plpgsql security definer set search_path = public as $$
declare t text := encode(gen_random_bytes(16), 'hex');
begin
  if not public.can_edit(pid) then raise exception 'ไม่มีสิทธิ์'; end if;
  update public.projects set share_token = t where id = pid;
  return t;
end $$;

create or replace function public.my_share_token(pid uuid)
returns text language sql stable security definer set search_path = public as $$
  select share_token from public.projects where id = pid and public.can_edit(pid);
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;
alter table public.crew_positions  enable row level security;
alter table public.events          enable row level security;
alter table public.doc_categories  enable row level security;
alter table public.doc_files       enable row level security;
alter table public.budgets         enable row level security;
alter table public.budget_lines    enable row level security;
alter table public.announcements   enable row level security;

-- profiles: yourself only (other names come through project_people()).
create policy profiles_self_read   on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- projects: members read · any logged-in user creates (becomes owner) · editors update · owner deletes.
create policy projects_read   on public.projects for select to authenticated using (public.is_member(id) or created_by = auth.uid());
create policy projects_insert on public.projects for insert to authenticated with check (created_by = auth.uid());
create policy projects_update on public.projects for update to authenticated using (public.can_edit(id)) with check (public.can_edit(id));
create policy projects_delete on public.projects for delete to authenticated using (public.is_owner(id));

-- members: members see the list · editors manage (only owners touch owner rows).
create policy members_read   on public.project_members for select to authenticated using (public.is_member(project_id));
create policy members_insert on public.project_members for insert to authenticated with check (public.can_edit(project_id) and (role <> 'owner' or public.is_owner(project_id)));
create policy members_update on public.project_members for update to authenticated using (public.can_edit(project_id) and (role <> 'owner' or public.is_owner(project_id))) with check (public.can_edit(project_id) and (role <> 'owner' or public.is_owner(project_id)));
create policy members_delete on public.project_members for delete to authenticated using ((public.can_edit(project_id) and (role <> 'owner' or public.is_owner(project_id))) or user_id = auth.uid());

create policy invites_all on public.project_invites for all to authenticated using (public.can_edit(project_id)) with check (public.can_edit(project_id));

-- working tables: owner/editor only. Viewers read through project_summary().
create policy crew_all    on public.crew_positions for all to authenticated using (public.can_edit(project_id)) with check (public.can_edit(project_id));
create policy events_all  on public.events         for all to authenticated using (public.can_edit(project_id)) with check (public.can_edit(project_id));
create policy doccat_all  on public.doc_categories for all to authenticated using (public.can_edit(project_id)) with check (public.can_edit(project_id));
create policy docfile_all on public.doc_files      for all to authenticated using (public.can_edit(project_id)) with check (public.can_edit(project_id));
create policy budget_all  on public.budgets        for all to authenticated using (public.can_edit(project_id)) with check (public.can_edit(project_id));
create policy bline_all   on public.budget_lines   for all to authenticated using (public.can_edit(project_id)) with check (public.can_edit(project_id));
create policy ann_read    on public.announcements  for select to authenticated using (public.can_edit(project_id));
create policy ann_insert  on public.announcements  for insert to authenticated with check (public.can_edit(project_id) and status = 'queued');

grant execute on function public.shared_summary(text) to anon, authenticated;
grant execute on function public.project_summary(uuid), public.invite_member(uuid, text, public.member_role), public.project_people(uuid),
  public.rotate_share_token(uuid), public.my_share_token(uuid), public.my_role(uuid),
  public.can_edit(uuid), public.is_member(uuid), public.is_owner(uuid) to authenticated;
revoke execute on function public.summary_json(uuid, boolean) from public, anon, authenticated;

-- =====================================================================
-- Storage: private bucket, files under projects/<project_id>/…
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)   -- 50 MB per file
on conflict (id) do nothing;

create policy files_read on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and (storage.foldername(name))[1] = 'projects' and public.is_member(((storage.foldername(name))[2])::uuid));
create policy files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and (storage.foldername(name))[1] = 'projects' and public.can_edit(((storage.foldername(name))[2])::uuid));
create policy files_update on storage.objects for update to authenticated
  using (bucket_id = 'project-files' and (storage.foldername(name))[1] = 'projects' and public.can_edit(((storage.foldername(name))[2])::uuid));
create policy files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and (storage.foldername(name))[1] = 'projects' and public.can_edit(((storage.foldername(name))[2])::uuid));

-- =====================================================================
-- Realtime: teammates see each other's changes live
-- =====================================================================
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.projects, public.crew_positions, public.events,
      public.doc_categories, public.doc_files, public.budgets, public.budget_lines, public.announcements;
  end if;
end $$;
