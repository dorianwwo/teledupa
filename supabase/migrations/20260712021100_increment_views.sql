-- Function to increment thread views
CREATE OR REPLACE FUNCTION public.increment_thread_views(_thread_id uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.threads SET views = views + 1 WHERE id = _thread_id;
$$;
