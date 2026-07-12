import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SiteNav, SiteFooter } from "./index";

export const Route = createFileRoute("/profil")({
  head: () => ({ meta: [{ title: "Mój profil - Teledupa" }] }),
  component: EditProfile,
});

function EditProfile() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [accentColor, setAccentColor] = useState("#38bdf8");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [profileComments, setProfileComments] = useState([]);
  const [newProfileComment, setNewProfileComment] = useState('');
  const [commentError, setCommentError] = useState(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setAccentColor(profile.accent_color ?? "#38bdf8");
      setAvatarUrl(profile.avatar_url);
      setBannerUrl(profile.banner_url);
      fetchFollowers();
      checkFollowing();
      fetchProfileComments();
    }
  }, [profile]);

  async function fetchFollowers() {
    if (!profile) return;
    const { count } = await supabase
      .from("profile_follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id);
    setFollowersCount(count ?? 0);
  }

  async function checkFollowing() {
    if (!user || !profile) return;
    const { data } = await supabase
      .from("profile_follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", user.id)
      .eq("following_id", profile.id);
    setIsFollowing((data && data.length > 0) || false);
  }

  async function toggleFollow() {
    if (!user || !profile) return;
    if (user.id === profile.id) return; // cannot follow self
    setError(null);
    if (isFollowing) {
      const { error } = await supabase
        .from("profile_follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profile.id);
      if (error) { setError(error.message); return; }
      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
    } else {
      const { error } = await supabase
        .from("profile_follows")
        .insert({ follower_id: user.id, following_id: profile.id });
      if (error) { setError(error.message); return; }
      setIsFollowing(true);
      setFollowersCount((c) => c + 1);
    }
  }

  async function fetchProfileComments() {
    if (!profile) return;
    const { data } = await supabase
      .from("profile_comments")
      .select("id, content, created_at, author:profiles!profile_comments_author_id_fkey(id,username,accent_color)")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: true });
    setProfileComments(data ?? []);
  }

  async function submitProfileComment(e) {
    e.preventDefault();
    if (!user || !newProfileComment.trim()) return;
    setCommentError(null);
    const { error } = await supabase.from("profile_comments").insert({
      profile_id: profile.id,
      author_id: user.id,
      content: newProfileComment.trim(),
    });
    if (error) { setCommentError(error.message); return; }
    setNewProfileComment('');
    fetchProfileComments();
  }

  if (authLoading) return <div className="min-h-screen bg-neutral-950 text-neutral-100"><SiteNav active="/profil" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
        <SiteNav active="/profil" />
        <main className="flex-1 max-w-3xl mx-auto px-6 py-10">
          <p className="text-neutral-400 text-sm">Musisz być zalogowany.</p>
        </main>
      </div>
    );
  }

  async function uploadFile(file: File, kind: "avatar" | "banner") {
    if (!user) return;
    setError(null);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (upErr) { setError(upErr.message); return; }
    const { data: signed } = await supabase.storage.from("profiles").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (!signed?.signedUrl) { setError("Nie udało się wygenerować URL."); return; }
    if (kind === "avatar") setAvatarUrl(signed.signedUrl);
    else setBannerUrl(signed.signedUrl);
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const { error: e } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      accent_color: accentColor,
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    setSaving(false);
    if (e) { setError(e.message); return; }
    setSavedMsg("Zapisano.");
    setTimeout(() => setSavedMsg(null), 2500);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      <SiteNav active="/profil" />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Mój profil</h1>
          {profile && user && user.id !== profile.id && (
            <button
              onClick={toggleFollow}
              className="ml-4 text-sm text-sky-400 hover:underline"
            >
              {isFollowing ? "Unfollow" : "Follow"}
            </button>
          )}
          {profile && (
            <button
              onClick={() => navigate({ to: "/uzytkownicy/$username", params: { username: profile.username } })}
              className="text-sm text-sky-400 hover:underline cursor-pointer"
            >
              Zobacz jako inni →
            </button>
          )}
        </div>

        <div className="mb-6 text-sm text-neutral-400">
          Obserwujący: <span className="font-bold text-white">{followersCount}</span>
          {profile && user && user.id !== profile.id && (
            <span className="ml-2 text-sm text-neutral-400">{isFollowing ? "(Following)" : ""}</span>
          )}
        </div>

          {error && <div className="mb-4 border border-sky-800 bg-sky-950/40 text-sky-300 px-3 py-2 text-sm rounded-none">{error}</div>}
          {/* Profile comments section */}
          <section className="mt-8">
            <h2 className="text-sm uppercase tracking-widest text-neutral-400 mb-4">Komentarze</h2>
            {user && (
              <form onSubmit={submitProfileComment} className="mb-4">
                {commentError && <div className="mb-2 border border-red-800 bg-red-950/40 text-red-300 px-3 py-2 text-sm">{commentError}</div>}
                <textarea
                  value={newProfileComment}
                  onChange={(e) => setNewProfileComment(e.target.value)}
                  placeholder="Dodaj komentarz..."
                  rows={3}
                  className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm rounded-none outline-none focus:border-sky-500/50"
                />
                <button type="submit" className="mt-2 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 text-sm rounded-none">Dodaj</button>
              </form>
            )}
            {profileComments.length === 0 ? (
              <p className="text-sm text-neutral-500">Brak komentarzy.</p>
            ) : (
              <div className="space-y-3">
                {profileComments.map((c) => (
                  <div key={c.id} className="border border-neutral-800 bg-neutral-900/40 p-3">
                    <div className="flex items-center text-sm mb-1">
                      {c.author && (
                        <span className="font-medium" style={{ color: c.author.accent_color ?? "#38bdf8" }}>@{c.author.username}</span>
                      )}
                      <span className="ml-2 text-neutral-500">{new Date(c.created_at).toLocaleString("pl-PL")}</span>
                    </div>
                    <p className="text-sm whitespace-pre-line">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        {savedMsg && <div className="mb-4 border border-green-800 bg-green-950/40 text-green-300 px-3 py-2 text-sm rounded-none">{savedMsg}</div>}

        {/* Banner preview */}
        <div className="rounded-none overflow-hidden border border-neutral-800 mb-4">
          <div
            className="h-32"
            style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(135deg, ${accentColor}33, #0a0a0a)` }}
          />
          <div className="p-4 -mt-10 flex items-end gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-20 h-20 rounded-none object-cover border-4 border-neutral-950 bg-neutral-900" />
            ) : (
              <div className="w-20 h-20 rounded-none flex items-center justify-center text-2xl font-bold border-4 border-neutral-950" style={{ background: accentColor }}>
                {profile?.username?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="pb-2">
              <p className="font-bold" style={{ color: accentColor }}>{displayName || profile?.username}</p>
              <p className="text-xs text-neutral-500">@{profile?.username}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm block">
            <span className="text-neutral-400">Avatar</span>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "avatar")}
              className="mt-1 w-full text-xs file:mr-3 file:bg-sky-600 file:hover:bg-sky-500 file:text-white file:border-0 file:px-3 file:py-1.5 file:rounded-none file:cursor-pointer" />
          </label>
          <label className="text-sm block">
            <span className="text-neutral-400">Banner</span>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "banner")}
              className="mt-1 w-full text-xs file:mr-3 file:bg-sky-600 file:hover:bg-sky-500 file:text-white file:border-0 file:px-3 file:py-1.5 file:rounded-none file:cursor-pointer" />
          </label>
        </div>

        <div className="mt-5 space-y-4">
          <label className="text-sm block">
            <span className="text-neutral-400">Wyświetlana nazwa</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-none outline-none focus:border-sky-500/50" />
          </label>
          <label className="text-sm block">
            <span className="text-neutral-400">Bio</span>
            <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)}
              className="mt-1 w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-none outline-none focus:border-sky-500/50" />
          </label>
          <label className="text-sm block">
            <span className="text-neutral-400">Kolor akcentu</span>
            <div className="flex gap-2 mt-1 items-center">
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-14 h-10 bg-transparent cursor-pointer" />
              <input type="text" value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-none outline-none focus:border-sky-500/50 font-mono text-xs" />
            </div>
          </label>
        </div>

        <button onClick={save} disabled={saving}
          className="mt-6 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-5 py-2 text-sm font-medium rounded-none cursor-pointer transition-colors">
          {saving ? "Zapisywanie..." : "Zapisz zmiany"}
        </button>
      </main>
      <SiteFooter />
    </div>
  );
}
