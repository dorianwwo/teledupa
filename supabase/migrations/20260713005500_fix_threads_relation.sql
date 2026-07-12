
-- Zmiana kluczy obcych threads.author_id oraz comments.author_id, aby wskazywały na public.profiles zamiast auth.users.
-- Umożliwi to PostgREST (Supabase JS client) automatyczne dołączanie profilu autora (username, itp.) do wątków i komentarzy.

-- 1. Poprawka dla tabeli threads
ALTER TABLE public.threads
  DROP CONSTRAINT IF EXISTS threads_author_id_fkey;

ALTER TABLE public.threads
  ADD CONSTRAINT threads_author_id_fkey 
  FOREIGN KEY (author_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- 2. Poprawka dla tabeli comments
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_author_id_fkey;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_author_id_fkey 
  FOREIGN KEY (author_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;
