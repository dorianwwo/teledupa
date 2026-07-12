import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "./index";
import { isIPBanned } from "@/lib/ip-check";
import { encrypt } from "@/lib/crypto";

export const Route = createFileRoute("/zarejestruj")({
  head: () => ({ meta: [{ title: "Zarejestruj - Teledupa" }] }),
  component: Register,
});

async function getClientIP(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "unknown";
  } catch {
    return "unknown";
  }
}

function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ipCheckLoading, setIpCheckLoading] = useState(false);
  const [canRegister, setCanRegister] = useState<boolean | null>(null);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  async function checkIP() {
    setIpCheckLoading(true);
    const ip = await getClientIP();
    
    // Check if IP is banned first
    const banCheck = await isIPBanned();
    if (banCheck.banned) {
      setError(`To IP jest zbanowane. Powód: ${banCheck.reason || "Nie podano"}`);
      setIpCheckLoading(false);
      return;
    }
    
    const encryptedIP = await encrypt(ip);
    
    const { data, error } = await supabase.rpc("can_register_ip" as any, { _ip_address: encryptedIP });
    setIpCheckLoading(false);
    if (error) {
      console.error("IP check error:", error);
      setCanRegister(true); // Allow if check fails
      return;
    }
    setCanRegister(data as boolean);
    if (!(data as boolean)) {
      // Calculate cooldown end time (10 minutes from last successful registration)
      const { data: attempts } = await supabase
        .from("registration_attempts" as any)
        .select("attempted_at")
        .eq("ip_address" as any, encryptedIP)
        .eq("success" as any, true)
        .order("attempted_at" as any, { ascending: false })
        .limit(1);
      if (attempts && attempts.length > 0) {
        const lastAttempt = new Date((attempts as any)[0].attempted_at);
        setCooldownEnd(lastAttempt.getTime() + 10 * 60 * 1000);
      }
    }
  }

  useEffect(() => {
    checkIP();
  }, []);

  // Countdown ticker
  useEffect(() => {
    if (!cooldownEnd) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, cooldownEnd - now);
      setCooldownLeft(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        clearInterval(timer);
        setCanRegister(true);
        setCooldownEnd(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownEnd]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    
    if (canRegister === false) {
      setError("Z tego adresu IP można utworzyć tylko jedno konto na 10 minut.");
      return;
    }
    
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      setError("Nazwa: 3-20 znaków, tylko a-z, 0-9, _");
      return;
    }
    
    // Password strength validation
    if (password.length < 8) {
      setError("Hasło minimum 8 znaków.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Hasło musi zawierać co najmniej jedną wielką literę.");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError("Hasło musi zawierać co najmniej jedną małą literę.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Hasło musi zawierać co najmniej jedną cyfrę.");
      return;
    }
    
    setLoading(true);
    const ip = await getClientIP();
    const encryptedIP = await encrypt(ip);
    
    // Record attempt before registration
    await supabase.rpc("record_registration_attempt" as any, { _ip_address: encryptedIP, _success: false });
    
    try {
      const res = await fetch("/api/public/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: clean, password }),
      });
      
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLoading(false);
        setError(data.error || "Błąd podczas rejestracji.");
        return;
      }
    } catch (e: any) {
      setLoading(false);
      setError("Wystąpił błąd komunikacji z serwerem rejestracji.");
      return;
    }
    
    // Record successful registration
    await supabase.rpc("record_registration_attempt" as any, { _ip_address: encryptedIP, _success: true });
    
    // Auto-login the user
    const email = `${clean}@teledupa.local`;
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    
    setLoading(false);
    if (signInErr) {
      // If auto-login fails, redirect to login page
      navigate({ to: "/zaloguj" });
      return;
    }
    navigate({ to: "/" });
  }

  const cooldownMins = Math.floor(cooldownLeft / 60);
  const cooldownSecs = cooldownLeft % 60;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col">
      <SiteNav active="/zarejestruj" />
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm border border-neutral-800 rounded-none p-8 bg-neutral-900/40">
          <h1 className="text-2xl font-semibold mb-6 text-center">Zarejestruj się</h1>
          
          {ipCheckLoading ? (
            <p className="text-neutral-500 text-sm text-center">Sprawdzanie limitu IP...</p>
          ) : canRegister === false ? (
            <div className="border border-neutral-800 bg-neutral-900/40 px-6 py-10 text-center">
              <p className="text-neutral-400 text-sm mb-2">Z tego IP można utworzyć konto raz na 10 minut.</p>
              <p className="text-2xl font-mono text-white">
                {String(cooldownMins).padStart(2, "0")}:{String(cooldownSecs).padStart(2, "0")}
              </p>
              <p className="text-xs text-neutral-500 mt-2">do następnej rejestracji</p>
            </div>
          ) : (
            <>
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
                  <p className="text-xs text-neutral-500 mt-1">Min. 8 znaków, wielka litera, mała litera, cyfra</p>
                </div>
                <button
                  disabled={loading}
                  type="submit"
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white py-2 text-sm font-medium rounded-none cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {loading ? "..." : "Utwórz konto"}
                </button>
              </form>
              <p className="text-xs text-neutral-600 mt-4 text-center">
                Ograniczenie: 1 konto na IP co 10 minut
              </p>
            </>
          )}
          
          <p className="text-sm text-neutral-400 mt-6 text-center">
            Masz już konto?{" "}
            <Link to="/zaloguj" className="text-sky-400 hover:underline cursor-pointer">
              Zaloguj się
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
