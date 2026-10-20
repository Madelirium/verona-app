-- An internal event-trigger function is not a browser RPC endpoint.
-- Keep its owner and trigger intact; only remove the inherited public grants.
begin;
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('public.rls_auto_enable()')
      and p.prorettype='pg_catalog.event_trigger'::pg_catalog.regtype
  ) then
    revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
  end if;
end $$;
commit;
