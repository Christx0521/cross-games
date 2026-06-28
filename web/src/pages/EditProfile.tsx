import { useEffect, useState, type FormEvent } from "react";
import { api, API_BASE, ApiError } from "../lib/api.ts";
import { type PublicProfile } from "../lib/profile.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { Card, Field, Button, Alert } from "../components/ui.tsx";

const MESSAGES: Record<string, string> = {
  invalid_country_code: "Código de país inválido (2 letras, p. ej. PA).",
  invalid_language_code: "Código de idioma inválido (2 letras, p. ej. es).",
  description_too_long: "La descripción supera los 280 caracteres.",
  unsupported_media_type: "Formato no soportado (usa PNG, JPEG o WebP).",
  file_too_large: "La imagen supera los 2 MB.",
};

export function EditProfile({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [languages, setLanguages] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get<PublicProfile>(`/users/${user.nickname}`).then((p) => {
      setDescription(p.description ?? "");
      setCountryCode(p.country_code ?? "");
      setLanguages(p.languages.join(", "));
      setAvatarUrl(p.avatar_url);
    });
  }, [user]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const langs = languages
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
      await api.patch("/me/profile", {
        description: description || null,
        countryCode: countryCode || null,
        languages: langs,
      });
      setInfo("Perfil guardado.");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "error";
      setError(MESSAGES[code] ?? "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setInfo("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api.upload<{ avatar_url: string }>("/me/avatar", form);
      setAvatarUrl(r.avatar_url);
      setInfo("Avatar actualizado.");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "error";
      setError(MESSAGES[code] ?? "Error al subir el avatar.");
    }
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold mb-6 text-[var(--color-pink)]">Editar perfil</h1>
      {error && <Alert kind="error">{error}</Alert>}
      {info && <Alert kind="success">{info}</Alert>}

      <div className="flex items-center gap-4 mb-6">
        {avatarUrl ? (
          <img src={`${API_BASE}${avatarUrl}`} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[var(--color-bg)]" />
        )}
        <label className="text-sm text-[var(--color-purple)] hover:underline cursor-pointer">
          Cambiar avatar
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadAvatar} />
        </label>
      </div>

      <form onSubmit={save}>
        <label className="block mb-4">
          <span className="block mb-1 text-sm text-[var(--color-comment)]">Descripción</span>
          <textarea
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-purple)]"
            rows={3}
            maxLength={280}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <Field
          label="País (ISO, 2 letras)"
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value.slice(0, 2))}
          placeholder="PA"
        />
        <Field
          label="Idiomas (separados por comas)"
          value={languages}
          onChange={(e) => setLanguages(e.target.value)}
          placeholder="es, en"
        />
        <Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar"}</Button>
      </form>
      <button onClick={onBack} className="mt-4 w-full text-sm text-[var(--color-comment)] hover:underline">
        Volver
      </button>
    </Card>
  );
}
