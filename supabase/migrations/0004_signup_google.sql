-- Sign-up profile fields, Google Calendar connections and per-event Google sync state.

-- ---------- profile: position + company ----------
alter table public.profiles
  add column if not exists position text not null default '',
  add column if not exists company  text not null default '';
alter table public.profiles drop constraint if exists profiles_position_check;
alter table public.profiles add constraint profiles_position_check
  check (position in ('', 'Director', 'Producer', 'Production Manager'));

-- Sign-up form metadata (full_name, position, company, phone) lands in the profile.
create or replace function public.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); v_pos text := coalesce(m ->> 'position', '');
begin
  if v_pos not in ('Director', 'Producer', 'Production Manager') then v_pos := ''; end if;
  insert into public.profiles (id, email, full_name, position, company, phone)
  values (new.id, lower(coalesce(new.email, '')), coalesce(m ->> 'full_name', ''), v_pos,
          left(coalesce(m ->> 'company', ''), 200), left(coalesce(m ->> 'phone', ''), 40))
  on conflict (id) do nothing;
  insert into public.project_members (project_id, user_id, role)
    select project_id, new.id, role from public.project_invites where email = lower(new.email)
  on conflict do nothing;
  delete from public.project_invites where email = lower(new.email);
  return new;
end $$;
revoke all on function public.on_auth_user_created() from public, anon, authenticated;

-- ---------- Google connections (server only: no client policies) ----------
create table if not exists public.google_connections (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  google_email   text not null default '',
  refresh_token  text not null,
  access_token   text,
  expires_at     timestamptz,
  connected_at   timestamptz not null default now()
);
alter table public.google_connections enable row level security;
revoke all on public.google_connections from anon, authenticated;
comment on table public.google_connections is 'OAuth tokens for Google Calendar. Read/written only by the server with the service-role key.';

-- What the signed-in user may know about their own connection (never the tokens).
create or replace function public.my_google_connection()
returns table (google_email text, connected_at timestamptz)
language sql stable security definer set search_path = public as $$
  select google_email, connected_at from public.google_connections where user_id = auth.uid();
$$;
revoke all on function public.my_google_connection() from public, anon;
grant execute on function public.my_google_connection() to authenticated;

-- ---------- events: Google sync state ----------
alter table public.events
  add column if not exists google_event_id  text,
  add column if not exists google_owner     uuid references public.profiles (id) on delete set null,
  add column if not exists google_synced_at timestamptz;

-- ---------- iCal feed: note when Google first fetches it ("ADD เสร็จสิ้น") ----------
alter table public.profiles add column if not exists calendar_feed_seen_at timestamptz;
create or replace function public.calendar_feed_seen(p_token text)
returns void language sql volatile security definer set search_path = public as $$
  update public.profiles set calendar_feed_seen_at = now()
  where p_token ~ '^[a-f0-9]{32,80}$' and calendar_token = p_token;
$$;
revoke all on function public.calendar_feed_seen(text) from public;
grant execute on function public.calendar_feed_seen(text) to anon, authenticated;

-- Members list shows each person's position and company (merged client-side with project_people()).
create or replace function public.project_people_info(pid uuid)
returns table (user_id uuid, job_title text, company text)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.position, p.company from public.project_members m join public.profiles p on p.id = m.user_id
   where m.project_id = pid and public.is_member(pid);
$$;
revoke all on function public.project_people_info(uuid) from public, anon;
grant execute on function public.project_people_info(uuid) to authenticated;
