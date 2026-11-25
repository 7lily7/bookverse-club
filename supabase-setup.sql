-- BookVerse file-sharing setup: run this once in Supabase SQL Editor.
-- The read library is public. Uploads require an authenticated, invited email.
-- Do not store private books or copyrighted files you are not permitted to share.

-- Create the bucket with a 20 MB size limit. Anonymous reads are public.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('bookclub-files', 'bookclub-files', true, 20971520)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 20971520;

CREATE TABLE IF NOT EXISTS public.club_members (
  email text PRIMARY KEY,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_member_email_normalized CHECK (email = lower(trim(email)))
);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
-- Members table is managed only by the Supabase owner through SQL.
-- No public SELECT, INSERT, UPDATE or DELETE permissions are granted.

DROP POLICY IF EXISTS "BookVerse public book browsing" ON storage.objects;
CREATE POLICY "BookVerse public book browsing" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'bookclub-files');

DROP POLICY IF EXISTS "BookVerse invited member uploads" ON storage.objects;
CREATE POLICY "BookVerse invited member uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bookclub-files'
    AND EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.email = lower(auth.jwt() ->> 'email')
    )
    AND lower(storage.extension(name)) IN ('pdf','epub','docx','txt','mobi')
    AND (
      name ~ '^[0-9]{2}-[12]--[a-f0-9-]+--[A-Za-z0-9._-]+$'
      OR name ~ '^other--[a-f0-9-]+--[A-Za-z0-9._-]+--[A-Za-z0-9._-]+$'
    )
  );

-- IMPORTANT: policy checks in the subquery must be able to read member rows.
-- We allow only users to look up their own invitation (never the whole list).
DROP POLICY IF EXISTS "Members check own invitation" ON public.club_members;
CREATE POLICY "Members check own invitation" ON public.club_members
  FOR SELECT TO authenticated
  USING (email = lower(auth.jwt() ->> 'email'));

GRANT SELECT ON public.club_members TO authenticated;

-- Example: replace the email below with YOUR ACTUAL CLUB MEMBER EMAIL.
-- Run separately in the SQL Editor for each member you invite:
-- INSERT INTO public.club_members(email) VALUES ('reader@example.com') ON CONFLICT DO NOTHING;
