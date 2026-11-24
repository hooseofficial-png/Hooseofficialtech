-- Calendar feed lookup without the service-role key: only a valid 32–80 hex token returns anything.
create or replace function public.calendar_feed(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me profiles%rowtype;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32,80}$' then return null; end if;
  select * into v_me from profiles where calendar_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'full_name', v_me.full_name,
    'projects', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'brand', p.brand, 'locations', p.locations, 'wrap_time', p.wrap_time))
       from projects p join project_members m on m.project_id = p.id where m.user_id = v_me.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'project_id', e.project_id, 'kind', e.kind, 'type', e.type, 'date', e.date, 'time', e.time, 'title', e.title))
       from events e join project_members m on m.project_id = e.project_id where m.user_id = v_me.id and e.date is not null), '[]'::jsonb));
end $$;
revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
