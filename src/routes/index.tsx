import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/lib/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Teledupa - Forum" },
      { name: "description", content: "Teledupa - forum do publikowania wątków." },
      { property: "og:title", content: "Teledupa" },
      { property: "og:description", content: "Teledupa - forum do publikowania wątków." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

type ThreadRow = {
  id: string;
  title: string;
  views: number;
  pinned: boolean;
  created_at: string;
  author: { username: string; accent_color: string | null } | null;
  comments: { count: number }[];
};

function Index() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [filteredThreads, setFilteredThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInContent, setSearchInContent] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("threads")
        .select("id,title,views,pinned,created_at,author:profiles!threads_author_id_fkey(username,accent_color),comments(count)")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      setThreads((data as unknown as ThreadRow[]) ?? []);
      setFilteredThreads((data as unknown as ThreadRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredThreads(threads);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = threads.filter(t => {
      const titleMatch = t.title.toLowerCase().includes(query);
      if (searchInContent) {
        // For content search, we'd need to fetch content separately
        // For now, just search title
        return titleMatch;
      }
      return titleMatch;
    });
    setFilteredThreads(filtered);
  }, [searchQuery, searchInContent, threads]);

  const displayThreads = searchQuery.trim() ? filteredThreads : threads;
  const pinned = displayThreads.filter((t) => t.pinned);
  const rest = displayThreads.filter((t) => !t.pinned);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      <SiteNav active="/" />

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col items-center">
          <img
            src="/incognito.png"
            alt="Logo"
            className="w-24 h-24 mb-3 select-none pointer-events-none"
            draggable="false"
          />
          <h1 className="text-3xl font-bold tracking-tight mb-1">Teledupa</h1>
          <a href="https://t.me/presbiz" target="_blank" rel="noopener noreferrer" className="text-sky-400 text-sm hover:underline cursor-pointer">
            Kanał Telegram Teledupa
          </a>
        </div>

        <div className="mt-10 flex flex-col items-center">
          <p className="text-sm text-neutral-400 mb-3 uppercase tracking-widest">Szukaj wątku</p>
          <div className="flex gap-6 text-sm mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="s" 
                checked={!searchInContent}
                onChange={() => setSearchInContent(false)}
                className="accent-sky-500" 
              />
              W tytule
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="s" 
                checked={searchInContent}
                onChange={() => setSearchInContent(true)}
                className="accent-sky-500" 
              />
              W treści
            </label>
          </div>
          <div className="flex rounded-none overflow-hidden">
            <input
              type="text"
              placeholder="Szukaj..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 px-3 py-2 w-80 text-sm outline-none focus:border-sky-500/50"
            />
            <button 
              onClick={() => setSearchQuery("")}
              className="bg-sky-600 hover:bg-sky-500 px-5 py-2 text-sm font-medium cursor-pointer transition-colors"
            >
              Szukaj
            </button>
          </div>
          <p className="text-xs text-neutral-500 mt-4">
            {loading ? "ładowanie..." : searchQuery.trim() ? `znaleziono ${filteredThreads.length} wątków` : `pokazuję ${threads.length} wątków`}
          </p>
        </div>

        {pinned.length > 0 && (
          <section className="mt-12">
            <h2 className="text-sm font-semibold mb-3 text-sky-400 uppercase tracking-widest">📌 Przypięte</h2>
            <ThreadTable rows={pinned} pinned />
          </section>
        )}

        <section className="mt-8 mb-16">
          <h2 className="text-sm font-semibold mb-3 text-neutral-400 uppercase tracking-widest">Najnowsze</h2>
          <ThreadTable rows={rest} />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function ThreadTable({ rows, pinned }: { rows: ThreadRow[]; pinned?: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="border border-neutral-800 rounded-none px-4 py-8 text-center text-sm text-neutral-500">
        Brak wątków.
      </div>
    );
  }
  return (
    <div className={`border rounded-none overflow-hidden ${pinned ? "border-sky-900/60" : "border-neutral-800"}`}>
      <table className="w-full text-sm">
        <thead className={pinned ? "bg-sky-950/30" : "bg-neutral-900"}>
          <tr className="text-left">
            <th className="px-4 py-3 font-semibold">Tytuł</th>
            <th className="px-4 py-3 font-semibold w-28">Komentarze</th>
            <th className="px-4 py-3 font-semibold w-28">Wyświetlenia</th>
            <th className="px-4 py-3 font-semibold w-40">Autor</th>
            <th className="px-4 py-3 font-semibold w-32 text-right">Dodano</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const commentCount = r.comments?.[0]?.count ?? 0;
            const authorColor = r.author?.accent_color ?? "#38bdf8";
            return (
              <tr
                key={r.id}
                className={`border-t ${pinned ? "border-sky-900/40 bg-sky-950/10 hover:bg-sky-950/25" : "border-neutral-800 hover:bg-neutral-900/70"} transition-colors`}
              >
                <td className="px-4 py-3">
                  <span 
                    onClick={() => window.location.href = `/watek/${r.id}`}
                    className="cursor-pointer hover:underline"
                  >
                    {r.title}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-400">{commentCount}</td>
                <td className="px-4 py-3 text-neutral-400">{r.views}</td>
                <td className="px-4 py-3">
                  {r.author ? (
                    <Link
                      to="/uzytkownicy/$username"
                      params={{ username: r.author.username }}
                      className="cursor-pointer hover:underline font-medium"
                      style={{ color: authorColor }}
                    >
                      {r.author.username}
                    </Link>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-neutral-500 text-xs">
                  {new Date(r.created_at).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SiteNav({ active }: { active: string }) {
  const { user, profile, role, loading } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto flex items-center px-6 py-3 text-sm">
        <Link to="/" className="text-lg font-bold mr-8 cursor-pointer flex items-center gap-2">
          Teledupa
        </Link>
        <div className="flex gap-5 flex-1">
          {[
            ["/", "Główna"],
            ["/dodaj", "Dodaj wątek"],
            ["/uzytkownicy", "Użytkownicy"],
            ["/ulepsz", "Ulepsz konto"],
            ["/galeria", "Wieśniaki"],
            ["/regulamin", "Regulamin"],
          ].map(([to, label]) => (
            <Link
              key={to}
              to={to}
              className={`cursor-pointer transition-colors ${active === to ? "text-white font-medium" : "text-neutral-400 hover:text-white"}`}
            >
              {label}
            </Link>
          ))}
          {role === "manager" && (
            <Link
              to="/manager"
              className={`cursor-pointer transition-colors ${active === "/manager" ? "text-purple-400 font-medium" : "text-purple-600 hover:text-purple-400"}`}
            >
              Panel Managera
            </Link>
          )}
        </div>
        <div className="flex gap-4 items-center">
          {loading ? (
            <span className="text-neutral-500 text-sm">...</span>
          ) : user && profile ? (
            <>
              <Link to="/profil" className="flex items-center gap-2 cursor-pointer hover:text-white text-neutral-300">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-none object-cover" />
                ) : (
                  <span className="w-6 h-6 rounded-none bg-sky-600 flex items-center justify-center text-xs font-bold text-white">
                    {profile.username[0]?.toUpperCase()}
                  </span>
                )}
                {profile.username}
              </Link>
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                Wyloguj
              </button>
            </>
          ) : (
            <>
              <Link to="/zaloguj" className={`cursor-pointer hover:text-white ${active === "/zaloguj" ? "text-white" : "text-neutral-400"}`}>
                Zaloguj
              </Link>
              <Link to="/zarejestruj" className="cursor-pointer bg-sky-600 hover:bg-sky-500 px-3 py-1 rounded-none transition-colors text-white">
                Zarejestruj
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-800 py-6 text-center text-xs text-neutral-500">
      © 2026 Teledupa · made with hate
    </footer>
  );
}
