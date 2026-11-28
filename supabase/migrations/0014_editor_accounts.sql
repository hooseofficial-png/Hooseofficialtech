-- Editor accounts: an app user whose LINE application was approved as an editor (and who is not a HOOSE admin)
-- gets the editor home page and cannot create projects / workspaces (production, PM, director, producer only).

create or replace function public.is_editor_account() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.line_users
                 where profile_id = (select auth.uid()) and role = 'editor' and status in ('approved', 'active'))
     and not exists (select 1 from public.hoose_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_editor_account() from public;
grant execute on function public.is_editor_account() to authenticated;

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert
  with check (created_by = (select auth.uid()) and not public.is_editor_account());
