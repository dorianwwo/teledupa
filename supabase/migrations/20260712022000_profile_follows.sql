-- Create profile_follows table for follow system
CREATE TABLE IF NOT EXISTS public.profile_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (follower_id, following_id)
);

GRANT SELECT ON public.profile_follows TO anon, authenticated;
GRANT INSERT, DELETE ON public.profile_follows TO authenticated;
GRANT ALL ON public.profile_follows TO service_role;

ALTER TABLE public.profile_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_follows readable" ON public.profile_follows FOR SELECT USING (true);
CREATE POLICY "profile_follows insert" ON public.profile_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "profile_follows delete" ON public.profile_follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);
