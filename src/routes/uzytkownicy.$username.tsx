import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SiteNav, SiteFooter } from "./index";

export const Route = createFileRoute("/uzytkownicy/$username")({
  head: ({ params }) => ({ meta: [{ title: `${params.username} - Teledupa` }] }),
  component: UserProfile,
});

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  accent_color: string | null;
  created_at: string;
};

type Thread = { id: string; title: string; created_at: string; views: number };

function UserProfile() {
  const { username } = Route.useParams();
  const { user: currentUser } = useAuth();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [role, setRole] = useState<string>("user");
  const [loading, setLoading] = useState(true);

  // Follow states
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  // Profile comments states
  const [profileComments, setProfileComments] = useState<any[]>([]);
  const [newProfileComment, setNewProfileComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (!p) { setLoading(false); return; }
      setProfile(p as Profile);

      const [{ data: t }, { data: r }, { count: followers }, { data: comments }] = await Promise.all([
        supabase.from("threads").select("id,title,created_at,views").eq("author_id", p.id).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("role").eq("user_id", p.id),
        supabase.from("profile_follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
        supabase.from("profile_comments").select("id, content, created_at, author:profiles!profile_comments_author_id_fkey(id,username,accent_color)").eq("profile_id", p.id).order("created_at", { ascending: true })
      ]);

      setThreads((t ?? []) as Thread[]);
      const roles = (r ?? []).map((x: { role: string }) => x.role);
      setRole(roles.includes("manager") ? "manager" : roles.includes("mod") ? "mod" : "user");
      setFollowersCount(followers ?? 0);
      setProfileComments(comments ?? []);

      if (currentUser) {
        const { data: followData } = await supabase
          .from("profile_follows")
          .select("*")
          .eq("follower_id", currentUser.id)
          .eq("following_id", p.id);
        setIsFollowing(!!(followData && followData.length > 0));
      } else {
        setIsFollowing(false);
      }

      setLoading(false);
    })();
  }, [username, currentUser]);

  async function toggleFollow() {
    if (!currentUser || !profile) return;
    if (currentUser.id === profile.id) return;
    setFollowError(null);
    if (isFollowing) {
      const { error } = await supabase
        .from("profile_follows")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", profile.id);
      if (error) { setFollowError(error.message); return; }
      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
    } else {
      const { error } = await supabase
        .from("profile_follows")
        .insert({ follower_id: currentUser.id, following_id: profile.id });
      if (error) { setFollowError(error.message); return; }
      setIsFollowing(true);
      setFollowersCount((c) => c + 1);
    }
  }

  async function submitProfileComment(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !newProfileComment.trim() || !profile) return;
    setCommentError(null);
    const { error } = await supabase.from("profile_comments").insert({
      profile_id: profile.id,
      author_id: currentUser.id,
      content: newProfileComment.trim(),
    });
    if (error) { setCommentError(error.message); return; }
    setNewProfileComment("");

    // Refetch comments
    const { data: comments } = await supabase
      .from("profile_comments")
      .select("id, content, created_at, author:profiles!profile_comments_author_id_fkey(id,username,accent_color)")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: true });
    setProfileComments(comments ?? []);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <SiteNav active="/uzytkownicy" />
        <main className="max-w-4xl mx-auto px-6 py-10 text-neutral-500 text-sm">Ładowanie...</main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <SiteNav active="/uzytkownicy" />
        <main className="max-w-4xl mx-auto px-6 py-10">
          <p className="text-neutral-400">Nie znaleziono użytkownika.</p>
          <Link to="/uzytkownicy" className="text-sky-400 hover:underline">← Wróć</Link>
        </main>
      </div>
    );
  }

  const color = profile.accent_color ?? (role === "manager" ? "#a855f7" : "#38bdf8");

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      <SiteNav active="/uzytkownicy" />
      <main className="max-w-4xl mx-auto px-6 py-6">
        <div className="rounded-none overflow-hidden border border-neutral-800">
          <div
            className="h-40 bg-neutral-900"
            style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(135deg, ${color}22, #0a0a0a)` }}
          />
          <div className="px-6 pb-6">
            <div className="flex items-start gap-4">
              <div className="-mt-12 relative z-1">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-24 h-24 rounded-none object-cover border-4 border-neutral-950 bg-neutral-900" />
                ) : (
                  <div className="w-24 h-24 rounded-none flex items-center justify-center text-3xl font-bold text-white border-4 border-neutral-950" style={{ background: color }}>
                    {profile.username[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="pt-2 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold" style={{ color }}>{profile.display_name || profile.username}</h1>
                  {currentUser && currentUser.id !== profile.id && (
                    <button
                      onClick={toggleFollow}
                      className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 text-xs font-medium transition-colors cursor-pointer"
                    >
                      {isFollowing ? "Obserwujesz" : "Obserwuj"}
                    </button>
                  )}
                </div>
                <p className="text-sm text-neutral-400 mt-1">
                  @{profile.username} · <span className="capitalize">{role}</span>
                </p>
                <p className="text-sm text-neutral-400 mt-2">
                  Obserwujący: <span className="font-bold text-white">{followersCount}</span>
                </p>
                {followError && <p className="text-red-400 text-xs mt-1">{followError}</p>}
              </div>
            </div>
            {profile.bio && <p className="mt-4 text-sm text-neutral-300 whitespace-pre-line">{profile.bio}</p>}
            <p className="mt-3 text-xs text-neutral-500">
              Dołączył: {new Date(profile.created_at).toLocaleDateString("pl-PL")}
            </p>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-sm mb-3 uppercase tracking-widest text-neutral-400">Wątki ({threads.length})</h2>
          {threads.length === 0 ? (
            <p className="text-sm text-neutral-500 border border-neutral-800 rounded-none px-4 py-6 text-center">Brak wątków.</p>
          ) : (
            <div className="border border-neutral-800 rounded-none overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {threads.map((t) => (
                    <tr key={t.id} className="border-t border-neutral-800 first:border-t-0 hover:bg-neutral-900/70">
                      <td className="px-4 py-3 hover:underline cursor-pointer">{t.title}</td>
                      <td className="px-4 py-3 text-right text-xs text-neutral-500">{new Date(t.created_at).toLocaleDateString("pl-PL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Comments Section */}
        <section className="mt-8 border-t border-neutral-800 pt-8">
          <h2 className="text-sm uppercase tracking-widest text-neutral-400 mb-4">Komentarze</h2>
          {currentUser && (
            <form onSubmit={submitProfileComment} className="mb-6">
              {commentError && <div className="mb-2 border border-red-800 bg-red-950/40 text-red-300 px-3 py-2 text-sm">{commentError}</div>}
              <textarea
                value={newProfileComment}
                onChange={(e) => setNewProfileComment(e.target.value)}
                placeholder="Dodaj komentarz..."
                rows={3}
                className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm rounded-none outline-none focus:border-sky-500/50"
              />
              <button type="submit" className="mt-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-1.5 text-sm rounded-none cursor-pointer transition-colors">
                Dodaj
              </button>
            </form>
          )}
          {profileComments.length === 0 ? (
            <p className="text-sm text-neutral-500">Brak komentarzy.</p>
          ) : (
            <div className="space-y-3">
              {profileComments.map((c) => (
                <div key={c.id} className="border border-neutral-800 bg-neutral-900/40 p-3 font-sans">
                  <div className="flex items-center text-sm mb-1">
                    {c.author && (
                      <span className="font-medium" style={{ color: c.author.accent_color ?? "#38bdf8" }}>@{c.author.username}</span>
                    )}
                    <span className="ml-2 text-neutral-500 text-xs">{new Date(c.created_at).toLocaleString("pl-PL")}</span>
                  </div>
                  <p className="text-sm text-neutral-300 whitespace-pre-line">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

