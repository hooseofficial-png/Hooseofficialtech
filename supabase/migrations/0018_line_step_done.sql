-- The applicant typed "เสร็จสิ้น" after booking the interview (so the 10-minute re-ask stops).
alter table public.line_users add column if not exists interview_booked_at timestamptz;
