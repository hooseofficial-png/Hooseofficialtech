-- Follow-ups for unfinished applications: 5 minutes after we asked for a link, then 1, 3 and 5 days later.
-- Supabase pg_cron calls the app every minute (pg_net); the app decides who needs a nudge.

alter table public.line_reminders drop constraint if exists line_reminders_kind_check;
alter table public.line_reminders add constraint line_reminders_kind_check
  check (kind in ('not_started', 'due_soon', 'overdue', 'done', 'nudge'));

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Shared secret the app checks on /api/line/followups (read by the job; never leaves the database otherwise).
insert into public.app_settings (key, value) values ('cron_key', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

select cron.schedule('hoose-line-followups', '* * * * *', $job$
  select net.http_post(
    url := 'https://app.hooseofficial.site/api/line/followups',
    headers := jsonb_build_object('content-type', 'application/json',
                                  'x-cron-key', (select value from public.app_settings where key = 'cron_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000);
$job$);
