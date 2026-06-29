export interface Post {
  id: string;
  seq: number;
  author_id: string;
  author_nickname: string;
  author_avatar: string | null;
  body: string;
  attachment_url: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  author_nickname: string;
  author_avatar: string | null;
  body: string;
  created_at: string;
}

export interface PostsPage {
  posts: Post[];
  nextCursor: string | null;
}
