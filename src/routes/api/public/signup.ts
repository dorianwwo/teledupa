import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { username, password } = await request.json();

          if (!username || !password) {
            return Response.json({ ok: false, error: "Nazwa użytkownika i hasło są wymagane." }, { status: 400 });
          }

          const clean = username.trim().toLowerCase();
          if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
            return Response.json({ ok: false, error: "Nazwa: 3-20 znaków, tylko a-z, 0-9, _" }, { status: 400 });
          }

          if (password.length < 8) {
            return Response.json({ ok: false, error: "Hasło musi mieć minimum 8 znaków." }, { status: 400 });
          }
          if (!/[A-Z]/.test(password)) {
            return Response.json({ ok: false, error: "Hasło musi zawierać co najmniej jedną wielką literę." }, { status: 400 });
          }
          if (!/[a-z]/.test(password)) {
            return Response.json({ ok: false, error: "Hasło musi zawierać co najmniej jedną małą literę." }, { status: 400 });
          }
          if (!/[0-9]/.test(password)) {
            return Response.json({ ok: false, error: "Hasło musi zawierać co najmniej jedną cyfrę." }, { status: 400 });
          }

          let supabaseAdmin;
          try {
            const clientModule = await import("@/integrations/supabase/client.server");
            supabaseAdmin = clientModule.supabaseAdmin;
          } catch (e: any) {
            console.error("Failed to load supabaseAdmin:", e);
            return Response.json({
              ok: false,
              error: "Brak klucza SUPABASE_SERVICE_ROLE_KEY w pliku .env (wymagany do automatycznego potwierdzania kont). Dodaj ten klucz lub wyłącz 'Confirm email' w ustawieniach Supabase Auth."
            }, { status: 500 });
          }

          // 1. Check if username is already taken in profiles table
          const { data: existing, error: checkError } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("username", clean)
            .maybeSingle();

          if (checkError) {
            console.error("Database check error:", checkError);
          }

          if (existing) {
            return Response.json({ ok: false, error: "Ta nazwa użytkownika jest już zajęta." }, { status: 400 });
          }

          // 2. Create the user using admin API with email_confirm: true
          const email = `${clean}@teledupa.local`;
          const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { username: clean },
          });

          if (authError || !created.user) {
            if (authError?.message?.includes("already registered") || authError?.message?.includes("already exists")) {
              return Response.json({ ok: false, error: "Ta nazwa użytkownika jest już zajęta." }, { status: 400 });
            }
            return Response.json({ ok: false, error: authError?.message || "Błąd rejestracji użytkownika." }, { status: 500 });
          }

          // 3. Fallback check: ensure profile was created via database trigger
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("id", created.user.id)
            .maybeSingle();

          if (!profile) {
            const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
              id: created.user.id,
              username: clean,
              display_name: clean,
            });
            if (profileError) {
              console.error("Manual profile creation failed:", profileError);
            }
          }

          // 4. Default role assignment (as 'user')
          try {
            const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
              user_id: created.user.id,
              role: "user",
            });
            if (roleError) console.error("Default role insert error:", roleError);
          } catch (err: any) {
            console.error("Default role insert error:", err);
          }

          return Response.json({ ok: true });
        } catch (err: any) {
          console.error("Signup handler error:", err);
          return Response.json({ ok: false, error: err.message || "Wystąpił nieoczekiwany błąd." }, { status: 500 });
        }
      },
    },
  },
});
