-- LINE assistant: long-term notes per person + "needs a human" flag for the admin page.
alter table public.line_users
  add column memory text not null default '',            -- short facts the assistant saved about this person
  add column needs_attention boolean not null default false, -- assistant asked the HOOSE team to reply
  add column attention_note text not null default '',
  add column attention_at timestamptz;
