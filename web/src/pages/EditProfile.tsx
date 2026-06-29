import { useEffect, useState, type FormEvent } from "react";
import { api, API_BASE, ApiError } from "../lib/api.ts";
import { type PublicProfile } from "../lib/profile.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { Field, Button, Alert } from "../components/ui.tsx";

interface BlockedUser {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

const MESSAGES: Record<string, string> = {
  invalid_country_code: "Código de país inválido (2 letras, p. ej. PA).",
  invalid_language_code: "Código de idioma inválido (2 letras, p. ej. es).",
  description_too_long: "La descripción supera los 280 caracteres.",
  too_many_games: "Máximo 12 juegos favoritos.",
  game_too_long: "Cada juego admite hasta 60 caracteres.",
  unsupported_media_type: "Formato no soportado (usa PNG, JPEG o WebP).",
  file_too_large: "La imagen supera los 2 MB.",
};

export function EditProfile({ onBack }: { onBack?: () => void }) {
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [languages, setLanguages] = useState("");
  const [games, setGames] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get<PublicProfile>(`/users/${user.nickname}`).then((p) => {
      setDescription(p.description ?? "");
      setCountryCode(p.country_code ?? "");
      setLanguages(p.languages.join(", "));
      setGames(p.games.join(", "));
      setAvatarUrl(p.avatar_url);
      setBannerUrl(p.banner_url);
    });
    api.get<BlockedUser[]>("/blocks").then(setBlocked).catch(() => setBlocked([]));
  }, [user]);

  async function unblock(id: string) {
    await api.del(`/blocks/${id}`);
    setBlocked((prev) => prev.filter((u) => u.id !== id));
  }

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
      const gameList = games
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);
      await api.patch("/me/profile", {
        description: description || null,
        countryCode: countryCode || null,
        languages: langs,
        games: gameList,
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

  async function uploadBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setInfo("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api.upload<{ banner_url: string }>("/me/banner", form);
      setBannerUrl(r.banner_url);
      setInfo("Banner actualizado.");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "error";
      setError(MESSAGES[code] ?? "Error al subir el banner.");
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-6 text-[var(--color-pink)]">Editar perfil</h1>
      {error && <Alert kind="error">{error}</Alert>}
      {info && <Alert kind="success">{info}</Alert>}

      {/* Banner */}
      <div className="mb-4">
        <div className="h-28 w-full rounded-lg overflow-hidden bg-gradient-to-r from-[var(--color-surface-2)] to-[var(--color-purple)]">
          {bannerUrl && <img src={`${API_BASE}${bannerUrl}`} alt="banner" className="h-28 w-full object-cover" />}
        </div>
        <label className="inline-block mt-2 text-sm text-[var(--color-purple)] hover:underline cursor-pointer">
          Cambiar banner
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadBanner} />
        </label>
      </div>

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
        <Field
          label="Juegos favoritos (separados por comas, máx 12)"
          value={games}
          onChange={(e) => setGames(e.target.value)}
          placeholder="Valorant, League of Legends, Apex"
        />
        <Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar"}</Button>
      </form>

      <div className="mt-8">
        <h2 className="text-sm uppercase text-[var(--color-comment)] mb-2">Usuarios bloqueados</h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-[var(--color-comment)]">No has bloqueado a nadie.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {blocked.map((u) => (
              <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-bg)]">
                {u.avatar_url ? (
                  <img src={`${API_BASE}${u.avatar_url}`} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-pink)] font-bold text-sm">
                    {u.nickname.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-[var(--color-text)]">{u.nickname}</span>
                <button onClick={() => void unblock(u.id)} className="text-sm text-[var(--color-purple)] hover:underline">
                  Desbloquear
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {onBack && (
        <button onClick={onBack} className="mt-4 w-full text-sm text-[var(--color-muted)] hover:underline">
          ← Volver al perfil
        </button>
      )}
    </div>
  );
}
