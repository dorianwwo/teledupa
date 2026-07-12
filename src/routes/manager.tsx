import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SiteNav, SiteFooter } from "./index";
import { decrypt, encrypt } from "@/lib/crypto";

export const Route = createFileRoute("/manager")({
  head: () => ({ meta: [{ title: "Panel Managera - Teledupa" }] }),
  component: ManagerPanel,
});

// SHA-256 hash of the panel access password "Teledupa-Manager-Ultra-Vault-Access-Secure-2026!#"
// Generated via: crypto.subtle.digest("SHA-256", new TextEncoder().encode("Teledupa-Manager-Ultra-Vault-Access-Secure-2026!#"))
// Change this constant to change the required panel password (generate new hash with the node snippet above).
const PANEL_PASSWORD_HASH = "d78a1900eab5b0271c13ea8b36de91a07468072faac7914f56ef155e58236285";

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type GalleryEntry = {
  id: string;
  name: string;
  real_name: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

type BannedIP = {
  id: string;
  ip_address: string;
  reason: string | null;
  banned_at: string;
};

type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
};

type Tab = "gallery" | "bans" | "users";

function ManagerPanel() {
  const { role, loading: authLoading } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [tab, setTab] = useState<Tab>("gallery");

  // Gallery state
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [galLoading, setGalLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRealName, setNewRealName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newImg, setNewImg] = useState("");
  const [newImages, setNewImages] = useState<File[]>([]);
  const [addingGal, setAddingGal] = useState(false);
  const [galMsg, setGalMsg] = useState<string | null>(null);

  // Bans state
  const [bans, setBans] = useState<BannedIP[]>([]);
  const [bansLoading, setBansLoading] = useState(false);
  const [newIP, setNewIP] = useState("");
  const [newReason, setNewReason] = useState("");
  const [addingBan, setAddingBan] = useState(false);
  const [banMsg, setBanMsg] = useState("");

  // Users state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userMsg, setUserMsg] = useState("");

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const hash = await sha256(pwInput);
    if (hash === PANEL_PASSWORD_HASH) {
      setUnlocked(true);
      setPwError("");
    } else {
      setPwError("Nieprawidłowe hasło panelu.");
    }
  }

  // Load gallery entries
  async function loadGallery() {
    setGalLoading(true);
    const { data } = await supabase.from("gallery_entries").select("*").order("created_at", { ascending: false });
    setEntries((data ?? []) as GalleryEntry[]);
    setGalLoading(false);
  }

  // Load IP bans
  async function loadBans() {
    setBansLoading(true);
    const { data } = await supabase.from("ip_bans" as any).select("*").order("banned_at", { ascending: false });
    const decryptedBans = await Promise.all(
      (data as any ?? []).map(async (ban: BannedIP) => ({
        ...ban,
        ip_address: await decrypt(ban.ip_address),
      }))
    );
    setBans(decryptedBans as BannedIP[]);
    setBansLoading(false);
  }

  // Load users
  async function loadUsers() {
    setUsersLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("id,username,display_name").order("created_at");
    const { data: roles } = await supabase.from("user_roles").select("user_id,role");
    const roleMap = new Map<string, string>();
    (roles ?? []).forEach((r: { user_id: string; role: string }) => roleMap.set(r.user_id, r.role));
    const merged = (profiles ?? []).map((p: { id: string; username: string; display_name: string | null }) => ({
      ...p,
      role: roleMap.get(p.id) ?? "user",
    }));
    setUsers(merged as UserRow[]);
    setUsersLoading(false);
  }

  useEffect(() => {
    if (!unlocked) return;
    if (tab === "gallery") loadGallery();
    if (tab === "bans") loadBans();
    if (tab === "users") loadUsers();
  }, [unlocked, tab]);

  async function addGalleryEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddingGal(true);
    // Upload images if any
    let imageUrls: string[] = [];
    if (newImages && newImages.length > 0) {
      for (const file of newImages) {
        const ext = file.name.split('.').pop() ?? 'png';
        const path = `${user?.id}/gallery-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('gallery_entries').upload(path, file, { upsert: true });
        if (upErr) { setGalMsg('Błąd uploadu: ' + upErr.message); setAddingGal(false); return; }
        const { data: signed } = await supabase.storage.from('gallery_entries').createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) imageUrls.push(signed.signedUrl);
      }
    }
    const { error } = await supabase.from("gallery_entries").insert({
      name: newName.trim(),
      real_name: newRealName.trim() || null,
      description: newDesc.trim() || null,
      image_url: imageUrls.join(',') || null,
    });
    setAddingGal(false);
    if (error) { setGalMsg("Błąd: " + error.message); return; }
    setNewName(""); setNewRealName(""); setNewDesc(""); setNewImg(""); setNewImages([]);
    setGalMsg("Dodano wpis.");
    setTimeout(() => setGalMsg(""), 3000);
    loadGallery();
  }

  async function removeGalleryEntry(id: string) {
    await supabase.from("gallery_entries").delete().eq("id", id);
    loadGallery();
  }

  async function addBan(e: React.FormEvent) {
    e.preventDefault();
    if (!newIP.trim()) return;
    setAddingBan(true);
    const encryptedIP = await encrypt(newIP.trim());
    const { error } = await supabase.from("ip_bans" as any).insert({
      ip_address: encryptedIP,
      reason: newReason.trim() || null,
    });
    setAddingBan(false);
    if (error) { setBanMsg("Błąd: " + error.message); return; }
    setNewIP(""); setNewReason("");
    setBanMsg("IP zbanowane.");
    setTimeout(() => setBanMsg(""), 3000);
    loadBans();
  }

  async function removeBan(id: string) {
    await supabase.from("ip_bans").delete().eq("id", id);
    loadBans();
  }

  async function deleteUser(userId: string, username: string) {
    if (!confirm(`Na pewno usunąć użytkownika @${username}? Tej operacji nie można cofnąć.`)) return;
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) { setUserMsg("Błąd: " + error.message); return; }
    setUserMsg(`Usunięto @${username}.`);
    setTimeout(() => setUserMsg(""), 3000);
    loadUsers();
  }

  async function promoteUser(userId: string, newRole: "mod" | "user") {
    // Remove existing mod/manager roles first
    await supabase.from("user_roles").delete().eq("user_id", userId).neq("role", "manager");
    if (newRole === "mod") {
      await supabase.from("user_roles").insert({ user_id: userId, role: "mod" });
    }
    setUserMsg("Rola zmieniona.");
    setTimeout(() => setUserMsg(""), 3000);
    loadUsers();
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <SiteNav active="/" />
      </div>
    );
  }

  if (role !== "manager") {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col">
        <SiteNav active="/" />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-neutral-500 text-sm">Brak dostępu.</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col">
        <SiteNav active="/" />
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm border border-neutral-800 p-8 bg-neutral-900/40">
            <h1 className="text-xl font-bold mb-6 text-center">Panel Managera</h1>
            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-neutral-400">Hasło panelu</label>
                <input
                  type="password"
                  value={pwInput}
                  onChange={(e) => setPwInput(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm rounded-none outline-none focus:border-purple-500/50"
                  placeholder="••••••••"
                  required
                />
              </div>
              {pwError && <p className="text-red-400 text-xs">{pwError}</p>}
              <button
                type="submit"
                className="w-full bg-purple-700 hover:bg-purple-600 text-white py-2 text-sm font-medium rounded-none cursor-pointer transition-colors"
              >
                Odblokuj
              </button>
            </form>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "gallery", label: "Galeria wstydu" },
    { id: "bans", label: "Bany IP" },
    { id: "users", label: "Użytkownicy" },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col">
      <SiteNav active="/" />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Panel Managera</h1>
          <span className="text-xs text-purple-400 border border-purple-800 px-2 py-1">MANAGER</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 mb-8">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                tab === t.id
                  ? "border-purple-500 text-white"
                  : "border-transparent text-neutral-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* GALLERY TAB */}
        {tab === "gallery" && (
          <div>
            <h2 className="text-sm uppercase tracking-widest text-neutral-400 mb-4">Dodaj wpis</h2>
            <form onSubmit={addGalleryEntry} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nazwa / nick *"
                required
                className="bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-purple-500/50"
              />
              <input
                value={newRealName}
                onChange={(e) => setNewRealName(e.target.value)}
                placeholder="Prawdziwe imię i nazwisko"
                className="bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-purple-500/50"
              />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files) {
                      const selected = Array.from(files).slice(0, 5);
                      setNewImg(selected.map((f) => f.name).join(", ")); // placeholder display
                      // Store files for upload
                      // We'll use a state variable newImages (to be added) to hold the File objects
                      setNewImages(selected);
                    }
                  }}
                  className="bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-purple-500/50"
                />
              <div className="flex gap-2 items-start">
                <button
                  type="submit"
                  disabled={addingGal}
                  className="bg-purple-700 hover:bg-purple-600 text-white px-5 py-2 text-sm font-medium rounded-none cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {addingGal ? "..." : "Dodaj"}
                </button>
                {galMsg && <span className="text-green-400 text-xs pt-2">{galMsg}</span>}
              </div>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Opis"
                rows={3}
                className="bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-purple-500/50 md:col-span-2"
              />
            </form>

            <h2 className="text-sm uppercase tracking-widest text-neutral-400 mb-3">Wpisy ({entries.length})</h2>
            {galLoading ? (
              <p className="text-neutral-500 text-sm">Ładowanie...</p>
            ) : entries.length === 0 ? (
              <p className="text-neutral-500 text-sm">Brak wpisów.</p>
            ) : (
              <div className="border border-neutral-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-900">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-semibold">Nazwa</th>
                      <th className="px-4 py-2 font-semibold">Prawdziwe imię</th>
                      <th className="px-4 py-2 font-semibold w-32 text-right">Akcja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-t border-neutral-800 hover:bg-neutral-900/50">
                        <td className="px-4 py-2">{e.name}</td>
                        <td className="px-4 py-2 text-neutral-400">{e.real_name ?? "—"}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => removeGalleryEntry(e.id)}
                            className="text-red-400 hover:text-red-300 text-xs cursor-pointer"
                          >
                            Usuń
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* BANS TAB */}
        {tab === "bans" && (
          <div>
            <h2 className="text-sm uppercase tracking-widest text-neutral-400 mb-4">Zbanuj IP</h2>
            <form onSubmit={addBan} className="flex flex-wrap gap-3 mb-8">
              <input
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                placeholder="Adres IP *"
                required
                className="bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-purple-500/50 w-48"
              />
              <input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Powód (opcjonalnie)"
                className="bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-purple-500/50 flex-1 min-w-48"
              />
              <button
                type="submit"
                disabled={addingBan}
                className="bg-red-700 hover:bg-red-600 text-white px-5 py-2 text-sm font-medium rounded-none cursor-pointer disabled:opacity-50 transition-colors"
              >
                {addingBan ? "..." : "Zbanuj"}
              </button>
              {banMsg && <span className="text-green-400 text-xs self-center">{banMsg}</span>}
            </form>

            <h2 className="text-sm uppercase tracking-widest text-neutral-400 mb-3">Aktywne bany ({bans.length})</h2>
            {bansLoading ? (
              <p className="text-neutral-500 text-sm">Ładowanie...</p>
            ) : bans.length === 0 ? (
              <p className="text-neutral-500 text-sm">Brak banów.</p>
            ) : (
              <div className="border border-neutral-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-900">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-semibold">Adres IP</th>
                      <th className="px-4 py-2 font-semibold">Powód</th>
                      <th className="px-4 py-2 font-semibold w-36 text-right">Data</th>
                      <th className="px-4 py-2 font-semibold w-24 text-right">Akcja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bans.map((b) => (
                      <tr key={b.id} className="border-t border-neutral-800 hover:bg-neutral-900/50">
                        <td className="px-4 py-2 font-mono text-red-400">{b.ip_address}</td>
                        <td className="px-4 py-2 text-neutral-400">{b.reason ?? "—"}</td>
                        <td className="px-4 py-2 text-right text-xs text-neutral-500">
                          {new Date(b.banned_at).toLocaleDateString("pl-PL")}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => removeBan(b.id)}
                            className="text-green-400 hover:text-green-300 text-xs cursor-pointer"
                          >
                            Odbanuj
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <div>
            {userMsg && (
              <div className="mb-4 border border-green-800 bg-green-950/40 text-green-300 px-3 py-2 text-sm">
                {userMsg}
              </div>
            )}
            <h2 className="text-sm uppercase tracking-widest text-neutral-400 mb-3">
              Wszyscy użytkownicy ({users.length})
            </h2>
            {usersLoading ? (
              <p className="text-neutral-500 text-sm">Ładowanie...</p>
            ) : (
              <div className="border border-neutral-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-900">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-semibold">Użytkownik</th>
                      <th className="px-4 py-2 font-semibold w-24">Rola</th>
                      <th className="px-4 py-2 font-semibold w-48 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t border-neutral-800 hover:bg-neutral-900/50">
                        <td className="px-4 py-2">
                          <span className={u.role === "manager" ? "text-purple-400" : u.role === "mod" ? "text-green-400" : "text-neutral-200"}>
                            @{u.username}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-neutral-400 capitalize">{u.role}</td>
                        <td className="px-4 py-2 text-right flex justify-end gap-3">
                          {u.role !== "manager" && (
                            <>
                              {u.role !== "mod" && (
                                <button
                                  onClick={() => promoteUser(u.id, "mod")}
                                  className="text-green-400 hover:text-green-300 text-xs cursor-pointer"
                                >
                                  → Mod
                                </button>
                              )}
                              {u.role === "mod" && (
                                <button
                                  onClick={() => promoteUser(u.id, "user")}
                                  className="text-yellow-400 hover:text-yellow-300 text-xs cursor-pointer"
                                >
                                  → User
                                </button>
                              )}
                              <button
                                onClick={() => deleteUser(u.id, u.username)}
                                className="text-red-400 hover:text-red-300 text-xs cursor-pointer"
                              >
                                Usuń konto
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
