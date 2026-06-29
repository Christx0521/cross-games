export interface StoryItem {
  id: string;
  image_url: string;
  caption: string;
  created_at: string;
  seen: boolean;
}

export interface StoryGroup {
  author: { id: string; nickname: string; avatar_url: string | null };
  stories: StoryItem[];
  has_unseen: boolean;
  is_me: boolean;
}
