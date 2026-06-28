import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api.ts";
import { flagEmoji } from "../lib/profile.ts";
import { Field, Button, Alert } from "../components/ui.tsx";

interface Forum {
  id: string;
  conversation_id: string;
  name: string;
  language_code: string;
  continent: string;
  country_code: string | null;
}

interface OpenForum {
  conversationId: string;
  forumId: string;
  title: string;
}

const CONTINENTS: Array<{ code: string; label: string }> = [
  { code: "", label: "Todos" },
  { code: "AF", label: "África" },
  { code: "AS", label: "Asia" },
  { code: "EU", label: "Europa" },
  { code: "NA", label: "Norteamérica" },
  { code: "SA", label: "Sudamérica" },
  { code: "OC", label: "Oceanía" },
  { code: "AN", label: "Antártida" },
];

const MESSAGES: Record<string, string> = {
  invalid_continent: "Continente inválido.",
  invalid_language_code: "Idioma inválido (2 letras).",
  invalid_country_code: "País inválido (2 letras).",
  invalid_request: "Revisa los datos del foro.",
};

export function Forums({ onOpenForum }: { onOpenForum: (f: OpenForum) => void }) {
  const [forums, setForums] = useState<Forum[]>([]);
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [continent, setContinent] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", languageCode: "", continent: "NA", countryCode: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (country) qs.set("country", country);
    if (language) qs.set("language", language);
    if (continent) qs.set("continent", continent);
    setForums(await api.get<Forum[]>(`/forums?${qs.toString()}`));
  }, [country, language, continent]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/forums", {
        name: form.name,
        languageCode: form.languageCode,
        continent: form.continent,
        countryCode: form.countryCode || null,
      });
      setForm({ name: "", languageCode: "", continent: "NA", countryCode: "" });
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? (MESSAGES[err.code] ?? "Error.") : "Error inesperado.");
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4 text-[var(--color-pink)]">Foros</h1>
      {error && <Alert kind="error">{error}</Alert>}

      <div className="grid grid-cols-3 gap-2 mb-4">
        <input
          className="px-2 py-1 rounded bg-[var(--color-bg)] text-sm text-[var(--color-text)] outline-none"
          placeholder="País (PA)"
          value={country}
          maxLength={2}
          onChange={(e) => setCountry(e.target.value)}
        />
        <input
          className="px-2 py-1 rounded bg-[var(--color-bg)] text-sm text-[var(--color-text)] outline-none"
          placeholder="Idioma (es)"
          value={language}
          maxLength={2}
          onChange={(e) => setLanguage(e.target.value)}
        />
        <select
          className="px-2 py-1 rounded bg-[var(--color-bg)] text-sm text-[var(--color-text)] outline-none"
          value={continent}
          onChange={(e) => setContinent(e.target.value)}
        >
          {CONTINENTS.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        {forums.length === 0 ? (
          <p className="text-sm text-[var(--color-comment)]">No hay foros con esos filtros.</p>
        ) : (
          forums.map((f) => (
            <div key={f.id} className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-[var(--color-bg)]">
              {f.country_code && <span>{flagEmoji(f.country_code)}</span>}
              <span className="flex-1 text-[var(--color-text)]">{f.name}</span>
              <span className="text-xs text-[var(--color-comment)] uppercase">{f.language_code} · {f.continent}</span>
              <button
                onClick={() => onOpenForum({ conversationId: f.conversation_id, forumId: f.id, title: f.name })}
                className="text-sm text-[var(--color-purple)] hover:underline"
              >
                Entrar
              </button>
            </div>
          ))
        )}
      </div>

      {showCreate ? (
        <form onSubmit={create} className="mb-4 p-3 rounded-lg bg-[var(--color-bg)]">
          <Field label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Field label="Idioma (es)" value={form.languageCode} maxLength={2} onChange={(e) => setForm({ ...form, languageCode: e.target.value })} required />
          <Field label="País (PA, opcional)" value={form.countryCode} maxLength={2} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} />
          <label className="block mb-4">
            <span className="block mb-1 text-sm text-[var(--color-comment)]">Continente</span>
            <select
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] outline-none"
              value={form.continent}
              onChange={(e) => setForm({ ...form, continent: e.target.value })}
            >
              {CONTINENTS.filter((c) => c.code).map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </label>
          <Button type="submit">Crear foro</Button>
        </form>
      ) : (
        <button onClick={() => setShowCreate(true)} className="mb-4 w-full text-sm text-[var(--color-purple)] hover:underline">
          + Crear un foro
        </button>
      )}
    </div>
  );
}
