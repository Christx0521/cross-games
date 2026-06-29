export type ThreadSort = "hot" | "new" | "top";

export interface Forum {
  id: string;
  conversation_id: string;
  name: string;
  language_code: string;
  continent: string;
  country_code: string | null;
}

export interface Thread {
  id: string;
  forum_id: string;
  author_id: string;
  author_nickname: string;
  title: string;
  body: string;
  attachment_url: string | null;
  created_at: string;
  score: number;
  comment_count: number;
  my_vote: number;
}

export interface Comment {
  id: string;
  thread_id: string;
  parent_id: string | null;
  author_id: string;
  author_nickname: string;
  body: string;
  created_at: string;
  score: number;
  my_vote: number;
}

export interface SearchResults {
  forums: Forum[];
  users: Array<{ id: string; nickname: string }>;
}

// Construye el árbol de comentarios a partir de la lista plana (parent_id).
export interface CommentNode extends Comment {
  children: CommentNode[];
}

export function buildCommentTree(comments: Comment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  for (const c of comments) byId.set(c.id, { ...c, children: [] });
  const roots: CommentNode[] = [];
  for (const c of comments) {
    const node = byId.get(c.id)!;
    if (c.parent_id && byId.has(c.parent_id)) byId.get(c.parent_id)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}
