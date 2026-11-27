-- Open Call: mark which LINE applicant the HOOSE team picked for a position (then the party code is sent).
alter table public.open_call_responses
  add column selected_at timestamptz,
  add column notified_at timestamptz;
