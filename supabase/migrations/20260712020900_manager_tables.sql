
-- Gallery entries table
CREATE TABLE IF NOT EXISTS public.gallery_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  real_name text,
  description text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gallery_entries TO anon, authenticated;
GRANT ALL ON public.gallery_entries TO service_role;
ALTER TABLE public.gallery_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gallery read all" ON public.gallery_entries FOR SELECT USING (true);
CREATE POLICY "gallery manager insert" ON public.gallery_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "gallery manager delete" ON public.gallery_entries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- IP bans table
CREATE TABLE IF NOT EXISTS public.ip_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL UNIQUE,
  reason text,
  banned_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ip_bans TO anon, authenticated;
GRANT ALL ON public.ip_bans TO service_role;
ALTER TABLE public.ip_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ip_bans manager read" ON public.ip_bans FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "ip_bans manager insert" ON public.ip_bans FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "ip_bans manager delete" ON public.ip_bans FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));
