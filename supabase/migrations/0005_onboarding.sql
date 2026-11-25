-- Onboarding wizard + welcome tour state per account.
alter table public.profiles
  add column if not exists onboarded_at timestamptz,
  add column if not exists tour_done_at timestamptz;
-- Accounts that existed before the wizard skip it (they still see the welcome tour once).
update public.profiles set onboarded_at = now() where onboarded_at is null and created_at < '2026-11-25T03:00:00Z';
