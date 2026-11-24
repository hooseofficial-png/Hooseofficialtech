-- Personal iCal feed for "Sync กับ Google Calendar" (/api/calendar/<token>.ics)
alter table public.profiles add column if not exists calendar_token text unique
  default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
update public.profiles set calendar_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') where calendar_token is null;
alter table public.profiles alter column calendar_token set not null;
comment on column public.profiles.calendar_token is 'Secret token for the personal iCal feed /api/calendar/<token> (Google Calendar subscription).';

create or replace function public.rotate_calendar_token()
returns text language plpgsql security definer set search_path = public as $$
declare t text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then raise exception 'ต้องเข้าสู่ระบบ'; end if;
  update public.profiles set calendar_token = t where id = auth.uid();
  return t;
end $$;
revoke execute on function public.rotate_calendar_token() from public, anon;
grant execute on function public.rotate_calendar_token() to authenticated;
