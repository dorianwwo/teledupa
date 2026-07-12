import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const username = "tgdon";
        const email = "tgdon@teledupa.local";
        const password = "tgdon-manager-2026";

        // idempotent: check if profile with this username exists
        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("username", username)
          .maybeSingle();

        if (existing) {
          return Response.json({ ok: true, created: false });
        }

        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { username },
        });
        if (error || !created.user) {
          return Response.json({ ok: false, error: error?.message }, { status: 500 });
        }

        await supabaseAdmin
          .from("profiles")
          .upsert({
            id: created.user.id,
            username,
            display_name: "tgdon",
            bio: "Manager Teledupa",
            accent_color: "#f43f5e",
          });

        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: created.user.id, role: "manager" });

        return Response.json({ ok: true, created: true });
      },
      GET: async () => Response.json({ hint: "POST to seed admin" }),
    },
  },
});
