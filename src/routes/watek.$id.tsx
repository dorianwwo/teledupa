import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SiteNav, SiteFooter } from "./index";

export const Route = createFileRoute("/watek/$id")({
  head: () => ({ meta: [{ title: `Wątek - Teledupa` }] }),
  component: ThreadView,
});

type Thread = {
  id: string;
  title: string;
  content: string;
  views: number;
  pinned: boolean;
  created_at: string;
  author: { id: string; username: string; accent_color: string | null } | null;
  image_urls: string | null;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  author: { id: string; username: string; accent_color: string | null } | null;
};

function ThreadView() {
  const params = Route.useParams() as { id: string };
  const { id } = params;
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [thread, setThread] = useState<Thread | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadThread();
    loadComments();
    incrementViews();
  }, [id]);

  async function loadThread() {
    const { data } = await supabase
      .from("threads" as any)
      .select("id,title,content,views,pinned,created_at,image_urls,author:profiles!threads_author_id_fkey(id,username,accent_color)")
      .eq("id", id)
      .single();
    setThread(data as unknown as Thread);
    setLoading(false);
  }

  async function loadComments() {
    const { data } = await supabase
      .from("comments" as any)
      .select("id,content,created_at,author:profiles!comments_author_id_fkey(id,username,accent_color)")
      .eq("thread_id", id)
      .order("created_at", { ascending: true });
    setComments((data as unknown as Comment[]) ?? []);
  }

  async function incrementViews() {
    await supabase.rpc("increment_thread_views" as any, { _thread_id: id });
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.from("comments").insert({
      thread_id: id,
      author_id: user.id,
      content: newComment.trim(),
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNewComment("");
    loadComments();
  }

  async function deleteThread() {
    if (!thread) return;
    if (!confirm(`Na pewno usunąć wątek "${thread.title}"? Tej operacji nie można cofnąć.`)) return;
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    navigate({ to: "/" });
  }

  async function deleteComment(commentId: string) {
    if (!confirm("Na pewno usunąć ten komentarz?")) return;
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) {
      setError(error.message);
      return;
    }
    loadComments();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <SiteNav active="/" />
        <main className="max-w-4xl mx-auto px-6 py-10 text-neutral-500 text-sm">Ładowanie...</main>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <SiteNav active="/" />
        <main className="max-w-4xl mx-auto px-6 py-10">
          <p className="text-neutral-400">Nie znaleziono wątku.</p>
          <Link to="/" className="text-sky-400 hover:underline">← Wróć</Link>
        </main>
      </div>
    );
  }

  const canDelete = user && (role === "manager" || role === "mod" || user.id === thread.author?.id);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      <SiteNav active="/" />
      <main className="max-w-4xl mx-auto px-6 py-8">
        {deleteError && (
          <div className="mb-4 border border-red-800 bg-red-950/40 text-red-300 px-3 py-2 text-sm">
            {deleteError}
          </div>
        )}

        <div className="border border-neutral-800 bg-neutral-900/40 p-6">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-2xl font-bold">{thread.title}</h1>
            {thread.pinned && <span className="text-sky-400 text-sm">📌 Przypięty</span>}
          </div>
          
          <div className="flex items-center gap-3 text-sm text-neutral-400 mb-4">
            {thread.author && (
              <Link
                to="/uzytkownicy/$username"
                params={{ username: thread.author.username }}
                className="hover:underline"
                style={{ color: thread.author.accent_color ?? "#38bdf8" }}
              >
                @{thread.author.username}
              </Link>
            )}
            <span>·</span>
            <span>{new Date(thread.created_at).toLocaleDateString("pl-PL")}</span>
            <span>·</span>
            <span>{thread.views} wyświetleń</span>
          </div>

          <div className="prose prose-invert max-w-none text-sm whitespace-pre-line">
            {thread.content}
          </div>

          {thread.image_urls && (
            <div className="mt-6 space-y-4">
              {thread.image_urls.split(',').filter(Boolean).map((url, i) => (
                <div key={i} className="max-w-xl overflow-hidden border border-neutral-800 bg-neutral-900/20">
                  <img 
                    src={url} 
                    alt={`Załącznik ${i + 1}`} 
                    className="w-full h-auto max-h-[600px] object-contain select-none"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

          {canDelete && (
            <button
              onClick={deleteThread}
              className="mt-6 text-red-400 hover:text-red-300 text-sm cursor-pointer"
            >
              Usuń wątek
            </button>
          )}
        </div>

        <section className="mt-8">
          <h2 className="text-sm uppercase tracking-widest text-neutral-400 mb-4">
            Komentarze ({comments.length})
          </h2>

          {user ? (
            <form onSubmit={submitComment} className="mb-6">
              {error && (
                <div className="mb-3 border border-sky-800 bg-sky-950/40 text-sky-300 px-3 py-2 text-sm">
                  {error}
                </div>
              )}
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Napisz komentarz..."
                rows={3}
                className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-sky-500/50 mb-3"
              />
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium cursor-pointer transition-colors"
              >
                {submitting ? "..." : "Dodaj komentarz"}
              </button>
            </form>
          ) : (
            <div className="border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-sm text-neutral-400 mb-6">
              <Link to="/zaloguj" className="text-sky-400 hover:underline">Zaloguj się</Link>, aby dodać komentarz.
            </div>
          )}

          {comments.length === 0 ? (
            <p className="text-sm text-neutral-500 border border-neutral-800 rounded-none px-4 py-6 text-center">
              Brak komentarzy.
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="border border-neutral-800 bg-neutral-900/40 p-4">
                  <div className="flex items-center gap-2 text-sm mb-2">
                    {comment.author && (
                      <Link
                        to="/uzytkownicy/$username"
                        params={{ username: comment.author.username }}
                        className="font-medium hover:underline"
                        style={{ color: comment.author.accent_color ?? "#38bdf8" }}
                      >
                        @{comment.author.username}
                      </Link>
                    )}
                    <span className="text-neutral-500 text-xs">
                      {new Date(comment.created_at).toLocaleString("pl-PL")}
                    </span>
                    {(user && (role === "manager" || role === "mod" || user.id === comment.author?.id)) && (
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="ml-auto text-red-400 hover:text-red-300 text-xs cursor-pointer"
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-line">{comment.content}</p>
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
