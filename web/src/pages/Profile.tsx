import { useEffect, useState } from "react";
import { api, API_BASE, ApiError } from "../lib/api.ts";
import { type PublicProfile, flagEmoji } from "../lib/profile.ts";
import { Card, Button, Alert } from "../components/ui.tsx";

export function Profile({ nickname, onBack }: { nickname: string; onBack: () => void }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<PublicProfile>(`/users/${nickname}`)
      .then(setProfile)
      .catch((err) => setError(err instanceof ApiError ? "Perfil no encontrado." : "Error inesperado."));
  }, [nickname]);

  if (error) {
    return (
      <Card>
        <Alert kind="error">{error}</Alert>
        <Button onClick={onBack}>Volver</Button>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <p className="text-[var(--color-comment)]">Cargando perfil…</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-4 mb-4">
        {profile.avatar_url ? (
          <img
            src={`${API_BASE}${profile.avatar_url}`}
            alt={profile.nickname}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-[var(--color-purple)]"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-[var(--color-bg)] flex items-center justify-center text-3xl text-[var(--color-comment)]">
            {profile.nickname.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-pink)]">{profile.nickname}</h1>
          <div className="flex items-center gap-2 mt-1">
            {profile.country_code && (
              <span className="text-lg">{flagEmoji(profile.country_code)}</span>
            )}
            {profile.is_adult && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-purple)] text-[var(--color-bg)] font-semibold">
                18+
              </span>
            )}
          </div>
        </div>
      </div>

      {profile.description && (
        <p className="mb-4 text-[var(--color-text)]">{profile.description}</p>
      )}

      {profile.languages.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {profile.languages.map((lang) => (
            <span key={lang} className="text-xs px-2 py-1 rounded-lg bg-[var(--color-bg)] text-[var(--color-comment)] uppercase">
              {lang}
            </span>
          ))}
        </div>
      )}

      <Button onClick={onBack}>Volver</Button>
    </Card>
  );
}
