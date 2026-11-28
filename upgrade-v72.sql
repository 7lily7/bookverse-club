-- Open registration; existing admin function is unchanged.
create or replace function public.bv_member() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and coalesce(auth.jwt()->>'role','')='authenticated' $$;
notify pgrst,'reload schema';
