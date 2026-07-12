import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SiteNav, SiteFooter } from "./index";

export const Route = createFileRoute("/dodaj")({
  head: () => ({ meta: [{ title: "Dodaj wątek - Teledupa" }] }),
  component: AddPost,
});

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function AddPost() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0); // seconds remaining

  // Check cooldown from last thread
  useEffect(() => {
    if (!user || role === "manager") return;
    (async () => {
      const { data } = await supabase
        .from("threads")
        .select("created_at")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const lastCreated = new Date(data[0].created_at).getTime();
        const elapsed = Date.now() - lastCreated;
        const remaining = Math.max(0, COOLDOWN_MS - elapsed);
        setCooldownLeft(Math.ceil(remaining / 1000));
      }
    })();
  }, [user, role]);

  // Countdown ticker
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = setInterval(() => {
      setCooldownLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownLeft]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    // Rate limit check for non-managers
    if (role !== "manager" && cooldownLeft > 0) {
      setError(`Poczekaj jeszcze ${Math.ceil(cooldownLeft / 60)} min ${cooldownLeft % 60} sek przed dodaniem kolejnego wątku.`);
      return;
    }
    setError(null);
    setLoading(true);
    // If there are images, upload them first
    let uploadedUrls: string[] = [];
    if (selectedFiles.length > 0) {
      setUploadingImages(true);
      const uploadPromises = selectedFiles.map(async (file) => {
        const ext = file.name.split('.').pop() ?? 'png';
        const path = `${user.id}/thread-${Date.now()}-${Math.random().toString(36).substring(2,8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('thread_media').upload(path, file);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from('thread_media').createSignedUrl(path, 60 * 60 * 24 * 365);
        return signed?.signedUrl ?? '';
      });
      try {
        uploadedUrls = await Promise.all(uploadPromises);
        setImageUrls(uploadedUrls);
      } catch (e) {
        setError((e as any).message || 'Błąd przy uploadzie zdjęć');
        setUploadingImages(false);
        return;
      }
      setUploadingImages(false);
    }

    const { error } = await supabase.from("threads").insert({
      author_id: user.id,
      title: title.trim(),
      content: content.trim(),
      pinned: role === "manager" ? pinned : false,
      image_urls: uploadedUrls.length > 0 ? uploadedUrls.join(',') : null,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate({ to: "/" });
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <SiteNav active="/dodaj" />
      </div>
    );
  }

  // Image input UI
  const imageInput = (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1 text-neutral-400">Zdjęcia (max 5)</label>
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={selectedFiles.length >= 5}
        onChange={(e) => {
          const files = e.target.files;
          if (!files) return;
          const arr = Array.from(files).slice(0, 5 - selectedFiles.length);
          setSelectedFiles((prev) => [...prev, ...arr]);
        }}
        className="mt-1 w-full text-xs file:mr-3 file:bg-sky-600 file:hover:bg-sky-500 file:text-white file:border-0 file:px-3 file:py-1.5 file:rounded-none file:cursor-pointer"
      />
      {selectedFiles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-neutral-800 px-2 py-1 rounded-none text-sm text-neutral-300">
              {f.name}
              <button
                type="button"
                onClick={() => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-300"
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const isOnCooldown = role !== "manager" && cooldownLeft > 0;
  const cooldownMins = Math.floor(cooldownLeft / 60);
  const cooldownSecs = cooldownLeft % 60;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col">
      <SiteNav active="/dodaj" />
      <main className="max-w-3xl mx-auto w-full px-6 py-10 flex-1">
        <h1 className="text-2xl font-semibold mb-6">Dodaj wątek</h1>

        {!user ? (
          <div className="border border-sky-900/50 bg-sky-950/20 px-4 py-3 text-sm rounded-none">
            Musisz być zalogowany, żeby dodać wątek.
          </div>
        ) : isOnCooldown ? (
          <div className="border border-neutral-800 bg-neutral-900/40 px-6 py-10 text-center">
            <p className="text-neutral-400 text-sm mb-2">Możesz dodawać wątki co 10 minut.</p>
            <p className="text-2xl font-mono text-white">
              {String(cooldownMins).padStart(2, "0")}:{String(cooldownSecs).padStart(2, "0")}
            </p>
            <p className="text-xs text-neutral-500 mt-2">do następnego wątku</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            {error && (
              <div className="mb-3 border border-sky-800 bg-sky-950/40 text-sky-300 px-3 py-2 text-sm">
                {error}
              </div>
            )}
            {imageInput}
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-400">Tytuł</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Wpisz tytuł..."
                className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm rounded-none outline-none focus:border-sky-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-400">Treść</label>
              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="Napisz treść wątku..."
                className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm rounded-none outline-none focus:border-sky-500/50 font-mono"
              />
            </div>
            {role === "manager" && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-sky-500" />
                Przypnij wątek (manager)
              </label>
            )}
            {uploadingImages && (
              <div className="text-sm text-neutral-400">Wgrywanie zdjęć…</div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                disabled={loading || uploadingImages}
                type="submit"
                className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-2 text-sm font-medium rounded-none cursor-pointer disabled:opacity-50 transition-colors"
              >
                {loading ? "..." : "Opublikuj"}
              </button>
              <button
                type="button"
                onClick={() => { setTitle(""); setContent(""); setSelectedFiles([]); setImageUrls([]); }}
                className="border border-neutral-800 px-5 py-2 text-sm rounded-none hover:bg-neutral-900 cursor-pointer"
              >
                Wyczyść
              </button>
            </div>
            {role !== "manager" && (
              <p className="text-xs text-neutral-600">Możesz dodawać wątki raz na 10 minut.</p>
            )}
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
