import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, API_BASE } from "../lib/api.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { VoteBar } from "../components/VoteBar.tsx";
import { MentionText } from "../components/MentionText.tsx";
import { Alert } from "../components/ui.tsx";
import {
  type Thread,
  type Comment,
  type CommentNode,
  buildCommentTree,
  timeAgo,
} from "../lib/forum.ts";

export function ThreadView({ threadId, onBack }: { threadId: string; onBack: () => void }) {
  const { user } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([
      api.get<Thread>(`/threads/${threadId}`),
      api.get<Comment[]>(`/threads/${threadId}/comments`),
    ]);
    setThread(t);
    setComments(c);
  }, [threadId]);

  useEffect(() => {
    void load().catch(() => setError("No se pudo cargar el hilo."));
  }, [load]);

  async function voteThread(next: number) {
    if (!thread) return;
    const prev = thread;
    setThread({ ...thread, my_vote: next, score: thread.score - thread.my_vote + next });
    try {
      const { score } = await api.post<{ score: number }>(`/threads/${threadId}/vote`, { value: next });
      setThread((t) => (t ? { ...t, score, my_vote: next } : t));
    } catch {
      setThread(prev);
      setError("Inicia sesión para votar.");
    }
  }

  async function voteComment(commentId: string, next: number) {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, my_vote: next, score: c.score - c.my_vote + next } : c))
    );
    try {
      const { score } = await api.post<{ score: number }>(`/comments/${commentId}/vote`, { value: next });
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, score, my_vote: next } : c)));
    } catch {
      void load();
      setError("Inicia sesión para votar.");
    }
  }

  async function submitComment(body: string, parentId: string | null): Promise<void> {
    const created = await api.post<Comment>(`/threads/${threadId}/comments`, { body, parentId });
    setComments((prev) => [...prev, created]);
    if (thread) setThread({ ...thread, comment_count: thread.comment_count + 1 });
  }

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    const body = reply.trim();
    if (!body) return;
    setError("");
    try {
      await submitComment(body, null);
      setReply("");
    } catch {
      setError("Inicia sesión para comentar.");
    }
  }

  if (!thread) {
    return (
      <div className="h-full flex flex-col">
        <Header onBack={onBack} title="Hilo" />
        {error && <div className="p-4"><Alert kind="error">{error}</Alert></div>}
      </div>
    );
  }

  const tree = buildCommentTree(comments);

  return (
    <div className="h-full flex flex-col">
      <Header onBack={onBack} title="Hilo" />
      <div className="flex-1 overflow-y-auto p-5">
        {error && <Alert kind="error">{error}</Alert>}

        {/* Post principal */}
        <div className="flex gap-3 pb-4 border-b border-[var(--color-border)]">
          <VoteBar score={thread.score} value={thread.my_vote} onVote={voteThread} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[var(--color-text)]">{thread.title}</h1>
            <p className="text-xs text-[var(--color-comment)] mb-2">
              por {thread.author_nickname} · {timeAgo(thread.created_at)}
            </p>
            {thread.attachment_url && (
              <img
                src={`${API_BASE}${thread.attachment_url}`}
                alt="adjunto"
                className="rounded-lg max-h-96 mb-2 object-contain"
              />
            )}
            {thread.body && <p className="text-[var(--color-text)]"><MentionText text={thread.body} /></p>}
          </div>
        </div>

        {/* Caja de comentario raíz */}
        <form onSubmit={sendReply} className="my-4 flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-pink)]"
            placeholder="Añade un comentario…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <button type="submit" className="px-4 rounded-lg font-semibold bg-[var(--color-pink)] text-[var(--color-bg)] hover:bg-[var(--color-magenta)]">
            Comentar
          </button>
        </form>

        <p className="text-sm text-[var(--color-comment)] mb-2">{thread.comment_count} comentarios</p>

        {tree.length === 0 ? (
          <p className="text-sm text-[var(--color-comment)]">Sé el primero en comentar.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {tree.map((node) => (
              <CommentItem
                key={node.id}
                node={node}
                depth={0}
                meId={user?.id ?? null}
                onVote={voteComment}
                onReply={submitComment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <header className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <button onClick={onBack} className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-lg">←</button>
      <h1 className="text-lg font-bold text-[var(--color-text)]">{title}</h1>
    </header>
  );
}

function CommentItem({
  node,
  depth,
  meId,
  onVote,
  onReply,
}: {
  node: CommentNode;
  depth: number;
  meId: string | null;
  onVote: (commentId: string, next: number) => void;
  onReply: (body: string, parentId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    await onReply(body, node.id);
    setText("");
    setOpen(false);
  }

  return (
    <div className={depth > 0 ? "pl-3 border-l-2 border-[var(--color-border)]" : ""}>
      <div className="flex gap-2">
        <VoteBar score={node.score} value={node.my_vote} onVote={(n) => onVote(node.id, n)} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--color-comment)]">
            <span className={node.author_id === meId ? "text-[var(--color-pink)] font-semibold" : "text-[var(--color-purple)] font-semibold"}>
              {node.author_nickname}
            </span>{" "}
            · {timeAgo(node.created_at)}
          </p>
          <p className="text-sm text-[var(--color-text)]"><MentionText text={node.body} /></p>
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-pink)] mt-0.5">
            Responder
          </button>
          {open && (
            <form onSubmit={send} className="mt-1 flex gap-2">
              <input
                autoFocus
                className="flex-1 px-2 py-1 rounded bg-[var(--color-surface-2)] text-sm text-[var(--color-text)] outline-none"
                placeholder="Responder…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button type="submit" className="px-3 rounded text-sm font-semibold bg-[var(--color-pink)] text-[var(--color-bg)]">
                Enviar
              </button>
            </form>
          )}
          {node.children.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {node.children.map((child) => (
                <CommentItem key={child.id} node={child} depth={depth + 1} meId={meId} onVote={onVote} onReply={onReply} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
