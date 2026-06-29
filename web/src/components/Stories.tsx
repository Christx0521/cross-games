import { useCallback, useEffect, useRef, useState } from "react";
import { api, API_BASE } from "../lib/api.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { type StoryGroup } from "../lib/stories.ts";

export function Stories() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewer, setViewer] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setGroups(await api.get<StoryGroup[]>("/stories"));
    } catch {
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createStory(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      await api.upload("/stories", form);
      await load();
    } catch {
      alert("No se pudo publicar la story (PNG/JPEG/WebP, máx 2 MB).");
    }
  }

  const myGroup = groups.find((g) => g.is_me);

  return (
    <div className="mb-5 flex gap-3 overflow-x-auto pb-1">
      {/* Crear / tu story */}
      <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1 shrink-0 w-16">
        <div className="relative w-14 h-14 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
          {myGroup?.author.avatar_url ? (
            <img src={`${API_BASE}${myGroup.author.avatar_url}`} alt="" className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <span className="text-[var(--color-pink)] font-bold text-lg">{user?.nickname.charAt(0).toUpperCase()}</span>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[var(--color-pink)] text-[var(--color-bg)] text-sm font-bold flex items-center justify-center">+</span>
        </div>
        <span className="text-xs text-[var(--color-muted)] truncate w-full text-center">Tu story</span>
      </button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={createStory} />

      {groups.map((g, i) => (
        <button key={g.author.id} onClick={() => setViewer(i)} className="flex flex-col items-center gap-1 shrink-0 w-16">
          <div
            className="w-14 h-14 rounded-full p-0.5"
            style={{
              background: g.has_unseen
                ? "linear-gradient(45deg, var(--color-pink), var(--color-purple))"
                : "var(--color-border)",
            }}
          >
            {g.author.avatar_url ? (
              <img src={`${API_BASE}${g.author.avatar_url}`} alt={g.author.nickname} className="w-full h-full rounded-full object-cover ring-2 ring-[var(--color-bg)]" />
            ) : (
              <div className="w-full h-full rounded-full bg-[var(--color-surface-2)] ring-2 ring-[var(--color-bg)] flex items-center justify-center text-[var(--color-pink)] font-bold">
                {g.author.nickname.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="text-xs text-[var(--color-muted)] truncate w-full text-center">
            {g.is_me ? "Tú" : g.author.nickname}
          </span>
        </button>
      ))}

      {viewer !== null && groups[viewer] && (
        <StoryViewer
          group={groups[viewer]!}
          onClose={() => {
            setViewer(null);
            void load();
          }}
          onPrevGroup={() => setViewer((v) => (v !== null && v > 0 ? v - 1 : v))}
          onNextGroup={() => setViewer((v) => (v !== null && v < groups.length - 1 ? v + 1 : null))}
        />
      )}
    </div>
  );
}

function StoryViewer({
  group,
  onClose,
  onPrevGroup,
  onNextGroup,
}: {
  group: StoryGroup;
  onClose: () => void;
  onPrevGroup: () => void;
  onNextGroup: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const story = group.stories[idx]!;

  // Marca como vista la story mostrada.
  useEffect(() => {
    void api.post(`/stories/${story.id}/view`, {}).catch(() => {});
  }, [story.id]);

  function next() {
    if (idx < group.stories.length - 1) setIdx(idx + 1);
    else onNextGroup();
  }
  function prev() {
    if (idx > 0) setIdx(idx - 1);
    else onPrevGroup();
  }

  async function remove() {
    if (!confirm("¿Borrar esta story?")) return;
    await api.del(`/stories/${story.id}`).catch(() => {});
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <div className="relative w-full max-w-sm h-full max-h-[90vh] flex flex-col p-3" onClick={(e) => e.stopPropagation()}>
        {/* Barras de progreso */}
        <div className="flex gap-1 mb-2">
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full bg-white/30">
              <div className="h-full rounded-full bg-white" style={{ width: i <= idx ? "100%" : "0%" }} />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-2 text-white">
          <span className="font-semibold">{group.is_me ? "Tú" : group.author.nickname}</span>
          <div className="ml-auto flex items-center gap-3">
            {group.is_me && (
              <button onClick={() => void remove()} title="Borrar" className="text-white/80 hover:text-white">🗑</button>
            )}
            <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">×</button>
          </div>
        </div>

        <div className="relative flex-1 rounded-lg overflow-hidden bg-black flex items-center justify-center">
          <img src={`${API_BASE}${story.image_url}`} alt="" className="max-h-full max-w-full object-contain" />
          {story.caption && (
            <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-white text-sm">
              {story.caption}
            </div>
          )}
          {/* Zonas de toque para navegar */}
          <button onClick={prev} className="absolute inset-y-0 left-0 w-1/3" aria-label="Anterior" />
          <button onClick={next} className="absolute inset-y-0 right-0 w-1/3" aria-label="Siguiente" />
        </div>
      </div>
    </div>
  );
}
