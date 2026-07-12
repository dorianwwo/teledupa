import { createFileRoute } from "@tanstack/react-router";
import { SiteNav, SiteFooter } from "./index";

export const Route = createFileRoute("/ulepsz")({
  head: () => ({
    meta: [
      { title: "Ulepsz konto - Teledupa" },
      { name: "description", content: "Ulepszone konta na Teledupa — wkrótce." },
    ],
  }),
  component: Upgrade,
});

function Upgrade() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col">
      <SiteNav active="/ulepsz" />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="text-6xl mb-6 select-none">🔒</div>
        <h1 className="text-3xl font-bold mb-3">Ulepszone konta</h1>
        <p className="text-neutral-400 text-lg max-w-md">
          Ta sekcja jest w trakcie przygotowań. Wkrótce będzie dostępna możliwość ulepszenia konta.
        </p>
        <p className="text-sm text-neutral-600 mt-6">Śledź kanał Telegram po aktualizacje.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
