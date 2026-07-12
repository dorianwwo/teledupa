import { createFileRoute } from "@tanstack/react-router";
import { SiteNav, SiteFooter } from "./index";

export const Route = createFileRoute("/regulamin")({
  head: () => ({
    meta: [
      { title: "Regulamin - Teledupa" },
      { name: "description", content: "Regulamin serwisu Teledupa." },
    ],
  }),
  component: Rules,
});

const rules = [
  "Zakaz publikowania treści z udziałem osób niepełnoletnich.",
  "Zakaz gróźb karalnych oraz nawoływania do przemocy.",
  "Zakaz publikowania danych osobowych osób trzecich bez podstawy.",
  "Zakaz spamu, reklam i multikont.",
  "Zakaz podszywania się pod administrację i innych użytkowników.",
  "Zakaz publikowania treści chronionych prawem autorskim bez zgody.",
  "Administracja zastrzega sobie prawo do usuwania wątków bez podania przyczyny.",
  "Korzystanie z serwisu jest równoznaczne z akceptacją regulaminu.",
];

function Rules() {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <SiteNav active="/regulamin" />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold text-center mb-8">Regulamin</h1>
        <div className="border border-neutral-800 bg-neutral-950 p-6">
          <ol className="space-y-4 list-decimal list-inside text-sm text-neutral-200">
            {rules.map((r, i) => (
              <li key={i} className="leading-relaxed">{r}</li>
            ))}
          </ol>
          <p className="mt-8 text-xs text-neutral-500 text-center">
            Ostatnia aktualizacja: 11 lipca 2026
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
