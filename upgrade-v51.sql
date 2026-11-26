-- Default bookclub-files bucket; requires V4 bv_member and bv_admin.
begin;
create table if not exists public.bv_recommendations(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid(),title text not null check(length(trim(title)) between 1 and 150),author text not null check(length(trim(author)) between 1 and 100),reason text not null check(length(trim(reason)) between 1 and 1000),created_at timestamptz default now());
alter table public.bv_recommendations enable row level security;
grant select,insert on public.bv_recommendations to authenticated;
drop policy if exists bv5_rec_read on public.bv_recommendations;
create policy bv5_rec_read on public.bv_recommendations for select to authenticated using(user_id=auth.uid() or public.bv_admin());
drop policy if exists bv5_rec_insert on public.bv_recommendations;
create policy bv5_rec_insert on public.bv_recommendations for insert to authenticated with check(user_id=auth.uid() and public.bv_member());

-- Replace the V5 approval-only guard; preserve private pending data and policies.
drop policy if exists bv5_insert_guard on storage.objects;
drop policy if exists bv5_publish on storage.objects;
drop policy if exists bv51_member_insert on storage.objects;
create policy bv51_member_insert on storage.objects for insert to authenticated with check(bucket_id='bookclub-files' and public.bv_member());
create policy bv5_insert_guard on storage.objects as restrictive for insert to public with check(case when bucket_id='bookclub-files' then case when auth.uid() is not null then public.bv_member() and lower(storage.extension(name)) in ('pdf','epub','docx','txt','mobi') and name ~ '^([0-9]{2}-[12]--[a-f0-9-]+--[A-Za-z0-9._-]+|other--[a-f0-9-]+--[A-Za-z0-9._-]+--[A-Za-z0-9._-]+)$' else false end when bucket_id='bookverse-pending' then false else true end);
-- Allow policy evaluation for anonymous requests; function returns false for no member.
grant execute on function public.bv_member(), public.bv_admin() to anon;
drop policy if exists bv5_delete_guard on storage.objects;
create policy bv5_delete_guard on storage.objects as restrictive for delete to public using(bucket_id not in ('bookclub-files','bookverse-pending') or public.bv_admin());
drop policy if exists bv5_update_guard on storage.objects;
create policy bv5_update_guard on storage.objects as restrictive for update to public using(bucket_id not in ('bookclub-files','bookverse-pending')) with check(bucket_id not in ('bookclub-files','bookverse-pending'));
update storage.buckets set file_size_limit=20971520 where id='bookclub-files';
commit;
