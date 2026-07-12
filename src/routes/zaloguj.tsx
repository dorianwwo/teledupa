import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "./index";

export const Route = createFileRoute("/zaloguj")({
  head: () => ({ meta: [{ title: "Zaloguj - Teledupa" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const cleanUsername = username.trim().toLowerCase();
    
    // resolve username → email
    const { data: prof } = await supabase
      .from("profiles")
      .select("id,username")
      .eq("username", cleanUsername)
      .maybeSingle();
      
    if (!prof) {
      setError("Nie znaleziono takiego użytkownika.");
      setLoading(false);
      return;
    }
    
    const email = `${cleanUsername}@teledupa.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    
    if (error) {
      if (error.message.includes("Email not confirmed")) {
        setError("Konto nie jest potwierdzone. Wyłącz 'Confirm email' w ustawieniach Supabase Auth lub dodaj SUPABASE_SERVICE_ROLE_KEY do pliku .env.");
      } else {
        setError("Błędna nazwa użytkownika lub hasło.");
      }
      return;
    }
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col">
      <SiteNav active="/zaloguj" />
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm border border-neutral-800 rounded-none p-8 bg-neutral-900/40">
          <h1 className="text-2xl font-semibold mb-6 text-center">Zaloguj się</h1>
          {error && <div className="mb-4 border border-sky-800 bg-sky-950/40 text-sky-300 px-3 py-2 text-sm rounded-none">{error}</div>}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm mb-1 text-neutral-400">Nazwa użytkownika</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm rounded-none outline-none focus:border-sky-500/50"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-neutral-400">Hasło</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm rounded-none outline-none focus:border-sky-500/50"
              />
            </div>
            <button
              disabled={loading}
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-500 text-white py-2 text-sm font-medium rounded-none cursor-pointer disabled:opacity-50 transition-colors"
            >
              {loading ? "Logowanie..." : "Zaloguj"}
            </button>
          </form>
          <p className="text-sm text-neutral-400 mt-6 text-center">
            Nie masz konta?{" "}
            <Link to="/zarejestruj" className="text-sky-400 hover:underline cursor-pointer">
              Zarejestruj się
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
