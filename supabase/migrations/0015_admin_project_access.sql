-- HOOSE admins (hoose_admins) can open and edit every project, without being added as members
-- (so they never show up in the project's team list or on the owner's pages).

create or replace function public.is_hoose_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hoose_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_hoose_admin() from public;
grant execute on function public.is_hoose_admin() to authenticated;

create or replace function public.is_member(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = pid and user_id = auth.uid())
      or public.is_hoose_admin();
$$;

create or replace function public.can_edit(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = pid and user_id = auth.uid() and role in ('owner', 'editor'))
      or public.is_hoose_admin();
$$;

create or replace function public.my_role(pid uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.project_members where project_id = pid and user_id = auth.uid()),
    case when public.is_hoose_admin() then 'editor'::member_role end);
$$;
