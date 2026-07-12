import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "./index";

export const Route = createFileRoute("/uzytkownicy")({
  head: () => ({ meta: [{ title: "Użytkownicy - Teledupa" }] }),
  component: Users,
});

type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  accent_color: string | null;
  created_at: string;
  role: "manager" | "mod" | "user";
};

function Users() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,accent_color,created_at")
        .order("created_at", { ascending: true });
      const { data: roles } = await supabase.from("user_roles").select("user_id,role");
      const roleMap = new Map<string, "manager" | "mod" | "user">();
      (roles ?? []).forEach((r: { user_id: string; role: "manager" | "mod" | "user" }) => {
        const cur = roleMap.get(r.user_id);
        if (r.role === "manager" || (!cur && r.role === "mod")) roleMap.set(r.user_id, r.role);
      });
      const merged = (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? "user" })) as UserRow[];
      setRows(merged);
      setLoading(false);
    })();
  }, []);

  const isExact = location.pathname === "/uzytkownicy" || location.pathname === "/uzytkownicy/";

  if (!isExact) {
    return <Outlet />;
  }

  const filtered = rows.filter((r) => r.username.toLowerCase().includes(query.toLowerCase()));
  const managers = filtered.filter((r) => r.role === "manager");
  const mods = filtered.filter((r) => r.role === "mod");
  const users = filtered.filter((r) => r.role === "user");

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      <SiteNav active="/uzytkownicy" />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-center">Użytkownicy</h1>
        <div className="mt-6 flex flex-col items-center">
          <div className="flex rounded-none overflow-hidden">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 px-3 py-2 w-80 text-sm outline-none focus:border-sky-500/50"
              placeholder="Szukaj użytkownika..."
            />
            <button className="bg-sky-600 hover:bg-sky-500 px-5 py-2 text-sm font-medium cursor-pointer">Szukaj</button>
          </div>
          <p className="text-xs text-neutral-500 mt-3">
            {loading ? "ładowanie..." : `pokazuję ${filtered.length} z ${rows.length} użytkowników`}
          </p>
        </div>

        {managers.length > 0 && <Group title="Manager" rows={managers} />}
        {mods.length > 0 && <Group title="Moderatorzy" rows={mods} />}
        <Group title="Użytkownicy" rows={users} />
      </main>
      <SiteFooter />
    </div>
  );
}

function Group({ title, rows }: { title: string; rows: UserRow[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm mb-2 uppercase tracking-widest text-neutral-400">{title}</h2>
      <div className="border border-neutral-800 rounded-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="text-left">
              <th className="px-4 py-2 font-semibold">Użytkownik</th>
              <th className="px-4 py-2 font-semibold w-32">Rola</th>
              <th className="px-4 py-2 font-semibold w-40 text-right">Dołączył</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const color = r.accent_color ?? (r.role === "manager" ? "#a855f7" : r.role === "mod" ? "#22c55e" : "#38bdf8");
              return (
                <tr key={r.id} className="border-t border-neutral-800 hover:bg-neutral-900/70 transition-colors">
                  <td className="px-4 py-2">
                    <Link
                      to="/uzytkownicy/$username"
                      params={{ username: r.username }}
                      className="cursor-pointer hover:underline font-medium inline-flex items-center gap-2"
                      style={{ color }}
                    >
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt="" className="w-6 h-6 rounded-none object-cover" />
                      ) : (
                        <span className="w-6 h-6 rounded-none flex items-center justify-center text-xs font-bold text-white" style={{ background: color }}>
                          {r.username[0]?.toUpperCase()}
                        </span>
                      )}
                      {r.username}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-400 capitalize">{r.role}</td>
                  <td className="px-4 py-2 text-right text-neutral-500 text-xs">
                    {new Date(r.created_at).toLocaleDateString("pl-PL")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
