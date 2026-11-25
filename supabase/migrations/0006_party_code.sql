-- Party Code: every project has a short join code. Joining needs an account + the code (replaces public share links).
-- Per-project position: what each member does in that project (Director / Producer / Production Manager / …).
-- Budget: only owner/editor ever see money (viewers never, share links retired).

-- ---------- code generator ----------
create or replace function public.gen_party_code()
returns text language plpgsql volatile set search_path = public as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.projects where party_code = c);
  end loop;
  return c;
end $$;

-- Lock rule ignores code rotation.
create or replace function public.enforce_details_lock()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.details_locked and new.details_locked and (
       (to_jsonb(new) - array['details_locked','locked_at','locked_by','share_enabled','share_token','share_budget','party_code','updated_at'])
    is distinct from
       (to_jsonb(old) - array['details_locked','locked_at','locked_by','share_enabled','share_token','share_budget','party_code','updated_at'])
  ) then
    raise exception 'รายละเอียดโปรเจกต์ถูกยืนยันและล็อกไว้ ปลดล็อกก่อนแก้ไข' using errcode = 'P0001';
  end if;
  if new.details_locked and not old.details_locked then
    new.locked_at := now(); new.locked_by := auth.uid();
  end if;
  return new;
end $$;

alter table public.projects add column if not exists party_code text;
update public.projects set party_code = public.gen_party_code() where party_code is null;
alter table public.projects alter column party_code set default public.gen_party_code();
alter table public.projects alter column party_code set not null;
create unique index if not exists projects_party_code_key on public.projects (party_code);

-- ---------- per-project position ----------
alter table public.project_members add column if not exists position text not null default '';

-- Creator's position in a new project = their profile position.
create or replace function public.on_project_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare t text; i int := 0;
begin
  if new.created_by is not null then
    insert into public.project_members (project_id, user_id, role, position)
    values (new.id, new.created_by, 'owner', coalesce((select position from public.profiles where id = new.created_by), ''))
    on conflict do nothing;
  end if;
  insert into public.budgets (project_id) values (new.id) on conflict do nothing;
  foreach t in array array['สคริปต์', 'สตอรี่บอร์ด', 'เบรกดาวน์', 'ช็อตลิสต์', 'คอลชีท', 'รายการพร็อพ', 'ใบอนุญาตสถานที่', 'สัญญา'] loop
    insert into public.doc_categories (project_id, title, sort) values (new.id, t, i); i := i + 1;
  end loop;
  return new;
end $$;

-- My role + position in a project.
create or replace function public.my_membership(pid uuid)
returns table (role public.member_role, job_title text, profile_title text)
language sql stable security definer set search_path = public as $$
  select m.role, m.position, p.position from public.project_members m join public.profiles p on p.id = m.user_id
   where m.project_id = pid and m.user_id = auth.uid();
$$;

create or replace function public.set_my_position(pid uuid, pos text)
returns void language sql volatile security definer set search_path = public as $$
  update public.project_members set position = left(coalesce(pos, ''), 60) where project_id = pid and user_id = auth.uid();
$$;

-- Members list: per-project position (falls back to the profile position).
create or replace function public.project_people_info(pid uuid)
returns table (user_id uuid, job_title text, company text)
language sql stable security definer set search_path = public as $$
  select m.user_id, coalesce(nullif(m.position, ''), p.position), p.company from public.project_members m join public.profiles p on p.id = m.user_id
   where m.project_id = pid and public.is_member(pid);
$$;

-- ---------- join with Party Code ----------
create table if not exists public.party_join_attempts (user_id uuid not null, at timestamptz not null default now());
alter table public.party_join_attempts enable row level security;
revoke all on public.party_join_attempts from anon, authenticated;

create or replace function public.join_project(code text, pos text default null)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); c text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g')); pid uuid;
begin
  if uid is null then raise exception 'เข้าสู่ระบบก่อนใส่ Party Code'; end if;
  if (select count(*) from public.party_join_attempts where user_id = uid and at > now() - interval '1 hour') >= 20 then
    raise exception 'ลองใส่ Code หลายครั้งเกินไป รอสักครู่แล้วลองใหม่';
  end if;
  select id into pid from public.projects where party_code = c;
  if pid is null then
    insert into public.party_join_attempts (user_id) values (uid);
    raise exception 'ไม่พบ Party Code นี้ ตรวจตัวอักษรอีกครั้ง';
  end if;
  insert into public.project_members (project_id, user_id, role, position)
  values (pid, uid, 'viewer', coalesce(nullif(pos, ''), (select position from public.profiles where id = uid), ''))
  on conflict (project_id, user_id) do update set position = case when nullif(pos, '') is null then public.project_members.position else excluded.position end;
  return pid;
end $$;

create or replace function public.rotate_party_code(pid uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare c text := public.gen_party_code();
begin
  if not public.can_edit(pid) then raise exception 'ไม่มีสิทธิ์'; end if;
  update public.projects set party_code = c where id = pid;
  return c;
end $$;

-- ---------- money: editors only; public links retired ----------
create or replace function public.project_summary(pid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member(pid) then return null; end if;
  return public.summary_json(pid, public.can_edit(pid));
end $$;

create or replace function public.shared_summary(token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select null::jsonb; -- public share links replaced by Party Code (account + code required)
$$;
update public.projects set share_enabled = false, share_budget = false where share_enabled or share_budget;

revoke all on function public.my_membership(uuid), public.set_my_position(uuid, text), public.join_project(text, text), public.rotate_party_code(uuid) from public, anon;
grant execute on function public.my_membership(uuid), public.set_my_position(uuid, text), public.join_project(text, text), public.rotate_party_code(uuid) to authenticated;
