import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "./index";

export const Route = createFileRoute("/galeria")({
  head: () => ({
    meta: [
      { title: "Wieśniaki - Teledupa" },
      { name: "description", content: "Wieśniaki Teledupa." },
    ],
  }),
  component: Gallery,
});

type GalleryEntry = {
  id: string;
  name: string;
  real_name: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

function Gallery() {
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("gallery_entries")
        .select("*")
        .order("created_at", { ascending: false });
      setEntries((data ?? []) as GalleryEntry[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <SiteNav active="/galeria" />
      <style>{`
        @keyframes rainbow {
          0% { color: #ff0000; }
          16% { color: #ff8800; }
          33% { color: #ffee00; }
          50% { color: #00ff00; }
          66% { color: #00ccff; }
          83% { color: #8800ff; }
          100% { color: #ff0000; }
        }
        .rainbow-text { animation: rainbow 4s linear infinite; }
      `}</style>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="rainbow-text text-4xl font-bold text-center tracking-wider mb-10">WIEŚNIAKI</h1>
        {loading ? (
          <p className="text-center text-neutral-500 text-sm">Ładowanie...</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-neutral-500 text-sm py-20">Brak wpisów w galerii wieśniaków.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {entries.map((e) => (
              <div key={e.id} className="bg-neutral-950 border border-neutral-900 flex flex-col">
                {e.image_url && (
                  <div className="p-3 flex justify-center bg-black">
                    <img src={e.image_url} alt={e.name} className="w-full h-64 object-cover" />
                  </div>
                )}
                <div className="p-4 text-center">
                  <span className="rainbow-text text-lg font-semibold">{e.name}</span>
                  {e.real_name && <p className="text-sm font-semibold mt-2">{e.real_name}</p>}
                  {e.description && (
                    <p className="text-sm text-neutral-300 mt-2 max-h-24 overflow-y-auto">{e.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
