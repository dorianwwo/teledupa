import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/setup-tables")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const statements = [
          `CREATE TABLE IF NOT EXISTS public.gallery_entries (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            real_name text,
            description text,
            image_url text,
            created_at timestamptz NOT NULL DEFAULT now()
          )`,
          `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gallery_entries' AND policyname = 'gallery read all') THEN
              ALTER TABLE public.gallery_entries ENABLE ROW LEVEL SECURITY;
              CREATE POLICY "gallery read all" ON public.gallery_entries FOR SELECT USING (true);
              CREATE POLICY "gallery manager insert" ON public.gallery_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'manager'));
              CREATE POLICY "gallery manager delete" ON public.gallery_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'manager'));
              GRANT SELECT ON public.gallery_entries TO anon, authenticated;
              GRANT ALL ON public.gallery_entries TO service_role;
            END IF;
          END $$`,
          `CREATE TABLE IF NOT EXISTS public.ip_bans (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            ip_address text NOT NULL UNIQUE,
            reason text,
            banned_at timestamptz NOT NULL DEFAULT now()
          )`,
          `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ip_bans' AND policyname = 'ip_bans manager read') THEN
              ALTER TABLE public.ip_bans ENABLE ROW LEVEL SECURITY;
              CREATE POLICY "ip_bans manager read" ON public.ip_bans FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'manager'));
              CREATE POLICY "ip_bans manager insert" ON public.ip_bans FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'manager'));
              CREATE POLICY "ip_bans manager delete" ON public.ip_bans FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'manager'));
              GRANT SELECT ON public.ip_bans TO anon, authenticated;
              GRANT ALL ON public.ip_bans TO service_role;
            END IF;
          END $$`,
        ];

        const results: { sql: string; ok: boolean; error?: string }[] = [];

        for (const sql of statements) {
          let rpcError: any = null;
          try {
            const rpcResult = await (supabaseAdmin as any).rpc("exec_sql", { sql }).single();
            rpcError = rpcResult.error;
          } catch {
            rpcError = { message: "rpc not available" };
          }
          // Try raw query via the Supabase REST
          try {
            const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY!,
                "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({ sql }),
            });
            results.push({ sql: sql.slice(0, 40), ok: resp.ok });
          } catch (e: any) {
            results.push({ sql: sql.slice(0, 40), ok: false, error: e.message });
          }
        }

        return Response.json({ ok: true, results });
      },
      GET: async () => Response.json({ hint: "POST to apply migration" }),
    },
  },
});
