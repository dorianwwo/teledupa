-- Registration rate limiting table (IP-based)
CREATE TABLE IF NOT EXISTS public.registration_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.registration_attempts TO authenticated, anon;
GRANT ALL ON public.registration_attempts TO service_role;
ALTER TABLE public.registration_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registration_attempts readable by all" ON public.registration_attempts FOR SELECT USING (true);

-- Index for efficient IP-based queries
CREATE INDEX IF NOT EXISTS registration_attempts_ip_idx ON public.registration_attempts(ip_address, attempted_at DESC);

-- Function to check if IP can register (max 1 successful registration per 10 minutes)
CREATE OR REPLACE FUNCTION public.can_register_ip(_ip_address text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.registration_attempts
    WHERE ip_address = _ip_address
    AND success = true
    AND attempted_at > now() - interval '10 minutes'
  );
$$;

-- Function to record registration attempt
CREATE OR REPLACE FUNCTION public.record_registration_attempt(_ip_address text, _success boolean)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.registration_attempts (ip_address, success)
  VALUES (_ip_address, _success);
$$;

-- Clean up old records (older than 1 day) - run this periodically
CREATE OR REPLACE FUNCTION public.cleanup_old_registration_attempts()
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.registration_attempts
  WHERE attempted_at < now() - interval '1 day';
$$;

-- Function to check if IP is banned
CREATE OR REPLACE FUNCTION public.is_ip_banned(_ip_address text)
RETURNS TABLE(banned boolean, reason text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    EXISTS (SELECT 1 FROM public.ip_bans WHERE ip_address = _ip_address) as banned,
    (SELECT reason FROM public.ip_bans WHERE ip_address = _ip_address LIMIT 1) as reason;
$$;
