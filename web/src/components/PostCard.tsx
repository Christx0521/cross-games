import { useState, type FormEvent } from "react";
import { api, API_BASE } from "../lib/api.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { timeAgo } from "../lib/forum.ts";
import { type Post, type PostComment } from "../lib/feed.ts";

function Avatar({ url, name, small = false }: { url: string | null; name: string; small?: boolean }) {
  // Clases estáticas: Tailwind no genera nombres construidos por interpolación.
  const box = small ? "w-7 h-7 text-xs" : "w-9 h-9";
  if (url) return <img src={`${API_BASE}${url}`} alt={name} className={`${box} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${box} rounded-full object-cover shrink-0 bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-pink)] font-bold`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function PostCard({ post, onDeleted }: { post: Post; onDeleted?: (id: string) => void }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [text, setText] = useState("");
  const mine = post.author_id === user?.id;

  async function toggleLike() {
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevCount + (prevLiked ? -1 : 1));
    try {
      const r = await api.post<{ liked: boolean; like_count: number }>(`/posts/${post.id}/like`, {});
      setLiked(r.liked);
      setLikeCount(r.like_count);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    }
  }

  async function openComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && comments === null) {
      try {
        setComments(await api.get<PostComment[]>(`/posts/${post.id}/comments`));
      } catch {
        setComments([]);
      }
    }
  }

  async function sendComment(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const created = await api.post<PostComment>(`/posts/${post.id}/comments`, { body });
    setComments((prev) => [...(prev ?? []), created]);
    setCommentCount((c) => c + 1);
    setText("");
  }

  async function remove() {
    if (!confirm("¿Borrar esta publicación?")) return;
    await api.del(`/posts/${post.id}`);
    onDeleted?.(post.id);
  }

  return (
    <article className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
      <header className="flex items-center gap-2 mb-2">
        <Avatar url={post.author_avatar} name={post.author_nickname} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--color-text)]">{post.author_nickname}</p>
          <p className="text-xs text-[var(--color-comment)]">{timeAgo(post.created_at)}</p>
        </div>
        {mine && (
          <button onClick={() => void remove()} className="text-[var(--color-muted)] hover:text-[var(--color-red)] text-sm" title="Borrar">
            🗑
          </button>
        )}
      </header>

      {post.body && <p className="text-[var(--color-text)] whitespace-pre-wrap mb-2">{post.body}</p>}
      {post.attachment_url && (
        <img src={`${API_BASE}${post.attachment_url}`} alt="adjunto" className="rounded-lg max-h-96 w-full object-cover mb-2" />
      )}

      <div className="flex items-center gap-4 text-sm text-[var(--color-muted)] pt-1">
        <button onClick={() => void toggleLike()} className="flex items-center gap-1 hover:text-[var(--color-pink)]">
          <span style={{ color: liked ? "var(--color-magenta)" : undefined }}>{liked ? "❤️" : "🤍"}</span>
          {likeCount}
        </button>
        <button onClick={() => void openComments()} className="flex items-center gap-1 hover:text-[var(--color-pink)]">
          💬 {commentCount}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-3">
          <form onSubmit={sendComment} className="flex gap-2 mb-3">
            <input
              className="flex-1 px-3 py-1.5 rounded-full bg-[var(--color-surface-2)] text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-pink)]"
              placeholder="Escribe un comentario…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="px-3 rounded-full text-sm font-semibold bg-[var(--color-pink)] text-[var(--color-bg)]">
              Enviar
            </button>
          </form>
          {comments === null ? (
            <p className="text-xs text-[var(--color-comment)]">Cargando…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-[var(--color-comment)]">Sé el primero en comentar.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar url={c.author_avatar} name={c.author_nickname} small />
                  <div className="min-w-0">
                    <p className="text-xs">
                      <span className="font-semibold text-[var(--color-purple)]">{c.author_nickname}</span>{" "}
                      <span className="text-[var(--color-comment)]">· {timeAgo(c.created_at)}</span>
                    </p>
                    <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
