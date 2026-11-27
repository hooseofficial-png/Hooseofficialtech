-- LINE recruiting: editor questionnaire answers (tapped on Flex cards) and the interview link sent by an admin.
alter table public.line_users
  add column survey jsonb not null default '{}'::jsonb,  -- { style, per_week, work, apps[] }
  add column survey_done_at timestamptz,
  add column interview_url text not null default '';
