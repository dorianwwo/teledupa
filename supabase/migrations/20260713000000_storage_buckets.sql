
-- ============================================================
-- Storage buckets (profiles bucket already exists, skip it)
-- ============================================================

-- 1. thread_media  (images attached to threads / posts)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thread_media',
  'thread_media',
  false,
  10485760,   -- 10 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. gallery_entries  (manager gallery images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery_entries',
  'gallery_entries',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS policies – thread_media
-- ============================================================

-- Anyone can read (needed for signed-URL generation & direct GET)
CREATE POLICY "thread_media public select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'thread_media');

-- Authenticated users may upload their own files
CREATE POLICY "thread_media authenticated insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'thread_media');

-- Users may delete their own uploads; managers can delete any
CREATE POLICY "thread_media owner or manager delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'thread_media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'manager')
    )
  );

-- ============================================================
-- RLS policies – gallery_entries
-- ============================================================

CREATE POLICY "gallery_entries public select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery_entries');

CREATE POLICY "gallery_entries manager insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gallery_entries'
    AND public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "gallery_entries manager delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'gallery_entries'
    AND public.has_role(auth.uid(), 'manager')
  );
